//! Close descriptors inherited from the host before any helper resource is created.
//! stdin/stdout/stderr are the protocol and diagnostics channels and remain open.

#[cfg(unix)]
pub fn close_inherited_fds() {
    let entries = std::fs::read_dir("/proc/self/fd")
        .or_else(|_| std::fs::read_dir("/dev/fd"));
    let Ok(entries) = entries else {
        eprintln!("nand-pty: unable to enumerate inherited file descriptors");
        return;
    };
    let descriptors: Vec<i32> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().to_string_lossy().parse::<i32>().ok())
        .filter(|fd| *fd > 2)
        .collect();
    for fd in descriptors {
        // Closing a descriptor that disappeared between enumeration and here is harmless.
        unsafe { libc::close(fd); }
    }
}

#[cfg(windows)]
pub fn close_inherited_fds() {}

