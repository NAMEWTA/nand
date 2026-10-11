//! NAND pseudo-terminal helper.
//!
//! Speaks length-prefixed frames on stdin/stdout (see `frame.rs`); never opens a port. Exits, ending
//! every session, when its standard input closes.

mod agent_data;
mod data;
mod frame;
mod inherited_fds;
mod job;
mod session;

use serde::Deserialize;
use serde_json::{json, Value};
use session::{control, Outbox, Sessions, SpawnRequest};
use std::{
    collections::HashMap,
    io::{self, Write},
    sync::mpsc,
    thread,
};

pub const PROTOCOL: u32 = 3;

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum Message {
    Hello {
        protocol: u32,
    },
    Spawn {
        sid: u32,
        file: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        cwd: Option<String>,
        #[serde(default)]
        env: HashMap<String, String>,
        cols: u16,
        rows: u16,
    },
    Resize {
        sid: u32,
        cols: u16,
        rows: u16,
    },
    Ack {
        sid: u32,
        bytes: u64,
    },
    End {
        sid: u32,
        #[serde(default)]
        force: bool,
    },
    History {
        op: String,
        rid: String,
        #[serde(default)]
        payload: Value,
    },
    Shutdown,
}

fn platform() -> &'static str {
    if cfg!(windows) {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    }
}

/// Handle one control message. Returns false when the helper should stop.
fn dispatch(out: &Outbox, sessions: &Sessions, history: &data::History, body: &[u8]) -> bool {
    let message: Message = match serde_json::from_slice(body) {
        Ok(message) => message,
        Err(error) => {
            control(out, json!({ "type": "error", "message": format!("invalid message: {error}") }));
            return true;
        }
    };
    match message {
        Message::Hello { protocol } => control(
            out,
            json!({
                "type": "hello",
                "protocol": PROTOCOL,
                "accepted": protocol == PROTOCOL,
                "version": env!("CARGO_PKG_VERSION"),
                "pid": std::process::id(),
                "platform": platform(),
            }),
        ),
        Message::Spawn { sid, file, args, cwd, env, cols, rows } => {
            match sessions.spawn(sid, SpawnRequest { file, args, cwd, env, cols, rows }) {
                Ok(pid) => control(out, json!({ "type": "spawned", "sid": sid, "pid": pid })),
                Err(message) => control(out, json!({ "type": "spawn-failed", "sid": sid, "message": message })),
            }
        }
        Message::Resize { sid, cols, rows } => {
            let _ = sessions.resize(sid, cols, rows);
        }
        Message::Ack { sid, bytes } => sessions.acknowledge(sid, bytes),
        Message::End { sid, force } => sessions.end(sid, force),
        Message::History { op, rid, payload } => history.handle(&op, rid, payload),
        Message::Shutdown => return false,
    }
    true
}

fn main() {
    // Do this before channels, threads, PTYs or history databases are created.
    if let Err(error) = inherited_fds::close_inherited_fds() {
        eprintln!("nand-pty: inherited descriptor cleanup failed: {error}");
        std::process::exit(1);
    }
    job::kill_children_with_helper();
    let (out, outgoing) = mpsc::channel::<Vec<u8>>();
    let writer = thread::spawn(move || {
        let stdout = io::stdout();
        let mut stdout = stdout.lock();
        for bytes in outgoing {
            if stdout.write_all(&bytes).and_then(|_| stdout.flush()).is_err() {
                break;
            }
        }
    });
    let sessions = Sessions::new(out.clone());
    let history = data::History::new(out.clone());
    let stdin = io::stdin();
    let mut input = stdin.lock();
    loop {
        match frame::read_frame(&mut input) {
            Ok(Some(frame)) => match frame.kind {
                frame::CONTROL => {
                    if !dispatch(&out, &sessions, &history, &frame.body) {
                        break;
                    }
                }
                frame::INPUT => {
                    if let Some((sid, bytes)) = frame::session_body(&frame.body) {
                        let _ = sessions.write(sid, bytes);
                    }
                }
                _ => control(&out, json!({ "type": "error", "message": "unknown frame kind" })),
            },
            Ok(None) => break,
            Err(error) => {
                eprintln!("nand-pty: {error}");
                break;
            }
        }
    }
    sessions.end_all();
    drop(out);
    drop(sessions);
    drop(history);
    // Exit reports may still be queued; give the writer a bounded moment to flush them.
    let (done, finished) = mpsc::channel();
    thread::spawn(move || {
        let _ = writer.join();
        let _ = done.send(());
    });
    let _ = finished.recv_timeout(std::time::Duration::from_secs(5));
    std::process::exit(0);
}
