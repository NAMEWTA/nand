//! Pseudo-terminal sessions: spawn, input, resize, flow-controlled output, exit and termination.

use crate::frame;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde_json::json;
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Sender},
        Arc, Condvar, Mutex,
    },
    thread,
    time::Duration,
};

/// Reading pauses when this many output bytes are unacknowledged and resumes below `RESUME_AT`.
pub const PAUSE_AT: u64 = 1024 * 1024;
pub const RESUME_AT: u64 = 256 * 1024;
const READ_CHUNK: usize = 64 * 1024;
/// How long `end` waits after the hangup before forcing the process down.
const GRACE: Duration = Duration::from_secs(2);
/// After the process exits, how long its remaining output may take to drain.
const DRAIN: Duration = Duration::from_secs(3);

pub type Outbox = Sender<Vec<u8>>;

pub fn control(out: &Outbox, message: serde_json::Value) {
    let _ = out.send(frame::encode(frame::CONTROL, message.to_string().as_bytes()));
}

/// Credit-based flow control for one session's output.
pub struct Flow {
    state: Mutex<(u64, bool)>,
    changed: Condvar,
}

impl Flow {
    pub fn new() -> Self {
        Self { state: Mutex::new((0, false)), changed: Condvar::new() }
    }
    /// Block while too much output is unacknowledged. Returns false once the session closed.
    pub fn wait_for_credit(&self) -> bool {
        let mut state = self.state.lock().unwrap();
        if state.0 >= PAUSE_AT {
            while state.0 > RESUME_AT && !state.1 {
                state = self.changed.wait(state).unwrap();
            }
        }
        !state.1
    }
    pub fn sent(&self, bytes: u64) {
        self.state.lock().unwrap().0 += bytes;
    }
    pub fn acknowledged(&self, bytes: u64) {
        let mut state = self.state.lock().unwrap();
        state.0 = state.0.saturating_sub(bytes);
        self.changed.notify_all();
    }
    pub fn close(&self) {
        self.state.lock().unwrap().1 = true;
        self.changed.notify_all();
    }
}

pub struct SpawnRequest {
    pub file: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
    pub env: HashMap<String, String>,
    pub cols: u16,
    pub rows: u16,
}

struct Session {
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    input: Mutex<Box<dyn Write + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    #[cfg_attr(windows, allow(dead_code))]
    pid: Option<u32>,
    flow: Arc<Flow>,
    exited: Arc<AtomicBool>,
}

#[derive(Clone)]
pub struct Sessions {
    out: Outbox,
    live: Arc<Mutex<HashMap<u32, Arc<Session>>>>,
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize { cols: cols.max(1), rows: rows.max(1), pixel_width: 0, pixel_height: 0 }
}

impl Sessions {
    pub fn new(out: Outbox) -> Self {
        Self { out, live: Arc::new(Mutex::new(HashMap::new())) }
    }

    pub fn spawn(&self, id: u32, request: SpawnRequest) -> Result<Option<u32>, String> {
        if self.live.lock().unwrap().contains_key(&id) {
            return Err(format!("session {id} already exists"));
        }
        let pair = native_pty_system()
            .openpty(size(request.cols, request.rows))
            .map_err(|error| error.to_string())?;
        let mut command = CommandBuilder::new(&request.file);
        command.args(&request.args);
        if let Some(cwd) = request.cwd.filter(|cwd| !cwd.is_empty()) {
            if !std::path::Path::new(&cwd).is_dir() {
                return Err(format!("working directory does not exist: {cwd}"));
            }
            command.cwd(cwd);
        }
        for (key, value) in &request.env {
            command.env(key, value);
        }
        let mut child = pair.slave.spawn_command(command).map_err(|error| error.to_string())?;
        drop(pair.slave);
        let reader = pair.master.try_clone_reader().map_err(|error| error.to_string())?;
        let input = pair.master.take_writer().map_err(|error| error.to_string())?;
        let pid = child.process_id();
        let session = Arc::new(Session {
            master: Mutex::new(Some(pair.master)),
            input: Mutex::new(input),
            killer: Mutex::new(child.clone_killer()),
            pid,
            flow: Arc::new(Flow::new()),
            exited: Arc::new(AtomicBool::new(false)),
        });
        self.live.lock().unwrap().insert(id, session.clone());

        // Output: forwarded in order, paused while the client has not caught up.
        let (drained_tx, drained_rx) = mpsc::channel::<()>();
        let out = self.out.clone();
        let flow = session.flow.clone();
        thread::spawn(move || {
            let mut reader = reader;
            let mut buffer = vec![0u8; READ_CHUNK];
            while flow.wait_for_credit() {
                match reader.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        flow.sent(n as u64);
                        if out.send(frame::encode_session(frame::OUTPUT, id, &buffer[..n])).is_err() {
                            break;
                        }
                    }
                }
            }
            let _ = drained_tx.send(());
        });

        // Exit: reported after the remaining output (or after a bounded drain wait).
        let out = self.out.clone();
        let live = self.live.clone();
        let watched = session.clone();
        thread::spawn(move || {
            let status = child.wait();
            watched.exited.store(true, Ordering::SeqCst);
            if drained_rx.recv_timeout(DRAIN).is_err() {
                // A background process can keep the terminal open; release it so the reader ends.
                watched.master.lock().unwrap().take();
                watched.flow.close();
            }
            let (code, signal) = match status {
                Ok(status) => (Some(status.exit_code()), status.signal().map(str::to_string)),
                Err(_) => (None, None),
            };
            live.lock().unwrap().remove(&id);
            watched.flow.close();
            watched.master.lock().unwrap().take();
            control(&out, json!({ "type": "exit", "sid": id, "code": code, "signal": signal }));
        });
        Ok(pid)
    }

    fn get(&self, id: u32) -> Option<Arc<Session>> {
        self.live.lock().unwrap().get(&id).cloned()
    }

    pub fn write(&self, id: u32, bytes: &[u8]) -> Result<(), String> {
        let session = self.get(id).ok_or_else(|| format!("no session {id}"))?;
        let mut input = session.input.lock().unwrap();
        input.write_all(bytes).and_then(|_| input.flush()).map_err(|error| error.to_string())
    }

    pub fn resize(&self, id: u32, cols: u16, rows: u16) -> Result<(), String> {
        let session = self.get(id).ok_or_else(|| format!("no session {id}"))?;
        let master = session.master.lock().unwrap();
        match master.as_ref() {
            Some(master) => master.resize(size(cols, rows)).map_err(|error| error.to_string()),
            None => Ok(()),
        }
    }

    pub fn acknowledge(&self, id: u32, bytes: u64) {
        if let Some(session) = self.get(id) {
            session.flow.acknowledged(bytes);
        }
    }

    /// Hang up, then force the process down if it is still running after the grace period.
    pub fn end(&self, id: u32, force: bool) {
        let Some(session) = self.get(id) else { return };
        if force {
            let _ = session.killer.lock().unwrap().kill();
            return;
        }
        hang_up(&session);
        thread::spawn(move || {
            thread::sleep(GRACE);
            if !session.exited.load(Ordering::SeqCst) {
                let _ = session.killer.lock().unwrap().kill();
            }
        });
    }

    /// Stop every session (the client went away).
    pub fn end_all(&self) {
        let sessions: Vec<Arc<Session>> = self.live.lock().unwrap().values().cloned().collect();
        for session in &sessions {
            hang_up(session);
        }
        let deadline = std::time::Instant::now() + GRACE;
        while std::time::Instant::now() < deadline && sessions.iter().any(|s| !s.exited.load(Ordering::SeqCst)) {
            thread::sleep(Duration::from_millis(50));
        }
        for session in sessions.iter().filter(|s| !s.exited.load(Ordering::SeqCst)) {
            let _ = session.killer.lock().unwrap().kill();
        }
    }
}

#[cfg(unix)]
fn hang_up(session: &Session) {
    // The child leads its own session, so its process group id is its pid.
    match session.pid {
        Some(pid) if pid > 0 => unsafe {
            libc::killpg(pid as libc::pid_t, libc::SIGHUP);
        },
        _ => {
            let _ = session.killer.lock().unwrap().kill();
        }
    }
}

#[cfg(windows)]
fn hang_up(session: &Session) {
    // Closing the pseudo console delivers CTRL_CLOSE_EVENT to the attached processes.
    session.master.lock().unwrap().take();
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::{sync::mpsc::Receiver, time::Instant};

    #[cfg(unix)]
    fn collect(rx: &Receiver<Vec<u8>>, until: impl Fn(&[u8], &[serde_json::Value]) -> bool) -> (Vec<u8>, Vec<serde_json::Value>) {
        let mut output = Vec::new();
        let mut messages = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(10);
        while Instant::now() < deadline && !until(&output, &messages) {
            let Ok(bytes) = rx.recv_timeout(Duration::from_millis(100)) else { continue };
            let frame = frame::read_frame(&mut &bytes[..]).unwrap().unwrap();
            match frame.kind {
                frame::OUTPUT => output.extend_from_slice(frame::session_body(&frame.body).unwrap().1),
                frame::CONTROL => messages.push(serde_json::from_slice(&frame.body).unwrap()),
                _ => panic!("unexpected frame"),
            }
        }
        (output, messages)
    }

    #[cfg(unix)]
    fn request(script: &str) -> SpawnRequest {
        SpawnRequest { file: "/bin/sh".into(), args: vec!["-c".into(), script.into()], cwd: None, env: HashMap::new(), cols: 80, rows: 24 }
    }

    #[cfg(unix)]
    #[test]
    fn output_arrives_before_the_exit_message() {
        let (tx, rx) = mpsc::channel();
        let sessions = Sessions::new(tx);
        sessions.spawn(1, request("printf 'one two three'; exit 3")).unwrap();
        let (output, messages) = collect(&rx, |_, messages| !messages.is_empty());
        assert!(String::from_utf8_lossy(&output).contains("one two three"));
        assert_eq!(messages[0]["type"], "exit");
        assert_eq!(messages[0]["code"], 3);
    }

    #[cfg(unix)]
    #[test]
    fn input_resize_and_environment_reach_the_process() {
        let (tx, rx) = mpsc::channel();
        let sessions = Sessions::new(tx);
        let mut req = request("read line; stty size; printf \"$NAND_PROBE:$line\"");
        req.env.insert("NAND_PROBE".into(), "env-ok".into());
        sessions.spawn(2, req).unwrap();
        sessions.resize(2, 120, 40).unwrap();
        sessions.write(2, b"typed\r").unwrap();
        let (output, _) = collect(&rx, |output, _| String::from_utf8_lossy(output).contains("env-ok:typed"));
        let text = String::from_utf8_lossy(&output);
        assert!(text.contains("40 120"), "{text}");
        assert!(text.contains("env-ok:typed"), "{text}");
    }

    #[cfg(unix)]
    #[test]
    fn unacknowledged_output_pauses_the_reader() {
        let (tx, rx) = mpsc::channel();
        let sessions = Sessions::new(tx);
        sessions.spawn(3, request("head -c 4000000 /dev/zero | tr '\\0' 'x'; sleep 5")).unwrap();
        thread::sleep(Duration::from_millis(1500));
        let mut received = 0usize;
        while let Ok(bytes) = rx.try_recv() {
            received += bytes.len();
        }
        assert!(received as u64 <= PAUSE_AT + READ_CHUNK as u64 + 4096, "received {received}");
        let session = sessions.get(3).unwrap();
        session.flow.acknowledged(PAUSE_AT);
        thread::sleep(Duration::from_millis(500));
        let mut more = 0usize;
        while let Ok(bytes) = rx.try_recv() {
            more += bytes.len();
        }
        assert!(more > 0, "reading resumed after acknowledgement");
        sessions.end(3, true);
    }

    #[cfg(unix)]
    #[test]
    fn ending_a_session_hangs_up_then_reports_exit() {
        let (tx, rx) = mpsc::channel();
        let sessions = Sessions::new(tx);
        sessions.spawn(4, request("trap '' TERM; sleep 30")).unwrap();
        thread::sleep(Duration::from_millis(200));
        sessions.end(4, false);
        let (_, messages) = collect(&rx, |_, messages| !messages.is_empty());
        assert_eq!(messages[0]["type"], "exit");
        assert!(sessions.get(4).is_none());
    }

    #[test]
    fn missing_programs_and_directories_are_reported() {
        let (tx, _rx) = mpsc::channel();
        let sessions = Sessions::new(tx);
        let missing = SpawnRequest { file: "nand-no-such-program-xyz".into(), args: vec![], cwd: None, env: HashMap::new(), cols: 80, rows: 24 };
        assert!(sessions.spawn(5, missing).is_err());
        let bad_cwd = SpawnRequest { file: "nand-no-such-program-xyz".into(), args: vec![], cwd: Some("/nand/no/such/dir".into()), env: HashMap::new(), cols: 80, rows: 24 };
        assert!(sessions.spawn(6, bad_cwd).unwrap_err().contains("working directory"));
    }
}
