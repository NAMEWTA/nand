//! The helper end to end over its standard streams.

use std::{
    io::{Read, Write},
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

fn frame(kind: u8, body: &[u8]) -> Vec<u8> {
    let mut out = ((body.len() + 1) as u32).to_be_bytes().to_vec();
    out.push(kind);
    out.extend_from_slice(body);
    out
}

fn control(json: &str) -> Vec<u8> {
    frame(1, json.as_bytes())
}

/// Reads frames off the helper's stdout on a thread.
fn frames(mut stdout: impl Read + Send + 'static) -> mpsc::Receiver<(u8, Vec<u8>)> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || loop {
        let mut header = [0u8; 4];
        if stdout.read_exact(&mut header).is_err() {
            return;
        }
        let mut body = vec![0u8; u32::from_be_bytes(header) as usize];
        if stdout.read_exact(&mut body).is_err() {
            return;
        }
        let kind = body.remove(0);
        if tx.send((kind, body)).is_err() {
            return;
        }
    });
    rx
}

#[cfg(unix)]
#[test]
fn handshake_session_and_shutdown_on_stdin_close() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_nand-pty"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let rx = frames(child.stdout.take().unwrap());

    stdin.write_all(&control(r#"{"type":"hello","protocol":3}"#)).unwrap();
    let (kind, body) = rx.recv_timeout(Duration::from_secs(5)).unwrap();
    assert_eq!(kind, 1);
    let hello: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(hello["type"], "hello");
    assert_eq!(hello["protocol"], 3);
    assert_eq!(hello["accepted"], true);

    stdin
        .write_all(&control(r#"{"type":"spawn","sid":9,"file":"/bin/sh","args":["-c","read x; echo got-$x"],"cols":80,"rows":24}"#))
        .unwrap();
    let mut input = 9u32.to_be_bytes().to_vec();
    input.extend_from_slice(b"ping\r");
    stdin.write_all(&frame(2, &input)).unwrap();

    let deadline = Instant::now() + Duration::from_secs(10);
    let (mut output, mut spawned, mut exit) = (String::new(), false, None);
    while Instant::now() < deadline && exit.is_none() {
        let Ok((kind, body)) = rx.recv_timeout(Duration::from_millis(200)) else { continue };
        match kind {
            3 => {
                assert_eq!(&body[..4], &9u32.to_be_bytes());
                output.push_str(&String::from_utf8_lossy(&body[4..]));
            }
            1 => {
                let message: serde_json::Value = serde_json::from_slice(&body).unwrap();
                match message["type"].as_str() {
                    Some("spawned") => spawned = true,
                    Some("exit") => exit = Some(message),
                    other => panic!("unexpected {other:?}"),
                }
            }
            _ => panic!("unexpected frame kind {kind}"),
        }
    }
    assert!(spawned);
    assert!(output.contains("got-ping"), "{output}");
    assert_eq!(exit.unwrap()["code"], 0);

    // A long-running session ends when the client goes away.
    stdin
        .write_all(&control(r#"{"type":"spawn","sid":10,"file":"/bin/sh","args":["-c","sleep 60"],"cols":80,"rows":24}"#))
        .unwrap();
    thread::sleep(Duration::from_millis(300));
    drop(stdin);
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(status) = child.try_wait().unwrap() {
            assert!(status.success());
            break;
        }
        assert!(Instant::now() < deadline, "helper did not exit after stdin closed");
        thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn version_mismatch_is_reported_and_bad_json_is_survived() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_nand-pty"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let rx = frames(child.stdout.take().unwrap());
    stdin.write_all(&control("not json")).unwrap();
    let (_, body) = rx.recv_timeout(Duration::from_secs(5)).unwrap();
    assert!(String::from_utf8_lossy(&body).contains("invalid message"));
    stdin.write_all(&control(r#"{"type":"hello","protocol":2}"#)).unwrap();
    let (_, body) = rx.recv_timeout(Duration::from_secs(5)).unwrap();
    let hello: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(hello["accepted"], false);
    stdin.write_all(&control(r#"{"type":"shutdown"}"#)).unwrap();
    let status = child.wait().unwrap();
    assert!(status.success());
}
