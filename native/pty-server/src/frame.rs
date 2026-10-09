//! Length-prefixed frames on the helper's standard streams.
//!
//! A frame is a 4-byte big-endian length of the rest, a 1-byte kind, then the body. Control bodies are
//! UTF-8 JSON objects; session input and output bodies start with a 4-byte big-endian session number.

use std::io::{self, Read};

pub const CONTROL: u8 = 1;
pub const INPUT: u8 = 2;
pub const OUTPUT: u8 = 3;
/// Largest accepted body (kind byte included).
pub const MAX_FRAME: usize = 16 * 1024 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub struct Frame {
    pub kind: u8,
    pub body: Vec<u8>,
}

/// Read one frame. `Ok(None)` is a clean end of stream between frames.
pub fn read_frame<R: Read>(input: &mut R) -> io::Result<Option<Frame>> {
    let mut header = [0u8; 4];
    let mut filled = 0;
    while filled < header.len() {
        let read = input.read(&mut header[filled..])?;
        if read == 0 {
            return if filled == 0 {
                Ok(None)
            } else {
                Err(io::Error::new(io::ErrorKind::UnexpectedEof, "truncated frame header"))
            };
        }
        filled += read;
    }
    let length = u32::from_be_bytes(header) as usize;
    if length == 0 || length > MAX_FRAME {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "frame length out of range"));
    }
    let mut rest = vec![0u8; length];
    input.read_exact(&mut rest)?;
    let kind = rest[0];
    rest.remove(0);
    Ok(Some(Frame { kind, body: rest }))
}

pub fn encode(kind: u8, body: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(body.len() + 5);
    out.extend_from_slice(&((body.len() + 1) as u32).to_be_bytes());
    out.push(kind);
    out.extend_from_slice(body);
    out
}

pub fn encode_session(kind: u8, session: u32, bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(bytes.len() + 9);
    out.extend_from_slice(&((bytes.len() + 5) as u32).to_be_bytes());
    out.push(kind);
    out.extend_from_slice(&session.to_be_bytes());
    out.extend_from_slice(bytes);
    out
}

/// Split a session body into its session number and bytes.
pub fn session_body(body: &[u8]) -> Option<(u32, &[u8])> {
    if body.len() < 4 {
        return None;
    }
    let session = u32::from_be_bytes([body[0], body[1], body[2], body[3]]);
    Some((session, &body[4..]))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Hands out its bytes in small, uneven pieces.
    struct Chunked {
        data: Vec<u8>,
        at: usize,
        step: usize,
    }
    impl Read for Chunked {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            let end = (self.at + self.step).min(self.data.len()).min(self.at + buf.len());
            let n = end - self.at;
            buf[..n].copy_from_slice(&self.data[self.at..end]);
            self.at = end;
            self.step = self.step % 3 + 1;
            Ok(n)
        }
    }

    #[test]
    fn empty_control_object_has_the_documented_bytes() {
        assert_eq!(encode(CONTROL, b"{}"), vec![0, 0, 0, 3, 1, b'{', b'}']);
    }

    #[test]
    fn frames_survive_arbitrary_chunking() {
        let mut data = encode(CONTROL, br#"{"type":"hello"}"#);
        data.extend(encode_session(OUTPUT, 7, b"abc"));
        let mut input = Chunked { data, at: 0, step: 1 };
        let first = read_frame(&mut input).unwrap().unwrap();
        assert_eq!(first.kind, CONTROL);
        assert_eq!(first.body, br#"{"type":"hello"}"#);
        let second = read_frame(&mut input).unwrap().unwrap();
        assert_eq!(second.kind, OUTPUT);
        assert_eq!(session_body(&second.body), Some((7, &b"abc"[..])));
        assert!(read_frame(&mut input).unwrap().is_none());
    }

    #[test]
    fn oversized_and_truncated_frames_are_errors() {
        let mut huge = io::Cursor::new(((MAX_FRAME + 1) as u32).to_be_bytes().to_vec());
        assert!(read_frame(&mut huge).is_err());
        let mut truncated = io::Cursor::new(vec![0, 0]);
        assert!(read_frame(&mut truncated).is_err());
        let mut short_body = io::Cursor::new(vec![0, 0, 0, 5, 1, b'{']);
        assert!(read_frame(&mut short_body).is_err());
    }
}
