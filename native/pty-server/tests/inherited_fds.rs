//! The helper closes inherited non-stdio descriptors in its own process.
#![cfg(unix)]

use std::io::{Read, Write};
use std::os::unix::io::FromRawFd;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
use std::sync::mpsc;

const F_GETFD: i32 = 1;
const F_SETFD: i32 = 2;
const FD_CLOEXEC: i32 = 1;

extern "C" {
    fn pipe(fds: *mut i32) -> i32;
    fn fcntl(fd: i32, cmd: i32, ...) -> i32;
    fn close(fd: i32) -> i32;
}

fn frame(body: &str) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&((body.len() + 1) as u32).to_be_bytes());
    out.push(1);
    out.extend_from_slice(body.as_bytes());
    out
}

#[test]
fn closes_inherited_descriptors_and_still_speaks_stdio() {
    let mut fds = [0i32; 2];
    assert_eq!(unsafe { pipe(fds.as_mut_ptr()) }, 0);
    let flags = unsafe { fcntl(fds[1], F_GETFD) };
    assert!(flags >= 0);
    assert_eq!(unsafe { fcntl(fds[1], F_SETFD, flags & !FD_CLOEXEC) }, 0);
    let mut child = Command::new(env!("CARGO_BIN_EXE_nand-pty"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("helper");
    assert_eq!(unsafe { close(fds[1]) }, 0);
    let read_fd = fds[0];
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut file = unsafe { std::fs::File::from_raw_fd(read_fd) };
        let mut buf = [0u8; 8];
        let read = file.read(&mut buf).map(|n| n).unwrap_or(usize::MAX);
        let _ = sender.send(read);
    });
    let closed = receiver.recv_timeout(Duration::from_secs(5)).expect("descriptor probe");
    assert_eq!(closed, 0, "inherited write end stayed open");
    let mut stdin = child.stdin.take().expect("stdin");
    stdin.write_all(&frame(r#"{"type":"hello","protocol":3}"#)).unwrap();
    drop(stdin);
    let mut stdout = child.stdout.take().expect("stdout");
    let mut header = [0u8; 5];
    stdout.read_exact(&mut header).expect("stdio reply");
    let length = u32::from_be_bytes([header[0], header[1], header[2], header[3]]) as usize;
    assert!(length > 1);
    let mut body = vec![0u8; length - 1];
    stdout.read_exact(&mut body).expect("reply body");
    let text = String::from_utf8(body).unwrap();
    assert!(text.contains("\"type\":\"hello\""), "{text}");
    let status = child.wait().expect("wait");
    assert!(status.success());
}
