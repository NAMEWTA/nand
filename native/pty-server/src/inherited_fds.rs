//! Close descriptors inherited from the host before any helper resource is created.
//! stdin/stdout/stderr are the protocol and diagnostics channels and remain open.

#[cfg(unix)]
pub fn close_inherited_fds() -> std::io::Result<()> {
    #[cfg(target_os = "linux")]
    let directory = "/proc/self/fd";
    #[cfg(not(target_os = "linux"))]
    let directory = "/dev/fd";
    // Collect before closing so read_dir's own descriptor is no longer in use.
    // Propagate enumeration errors instead of silently leaving some host resources open.
    let mut descriptors = Vec::new();
    for entry in std::fs::read_dir(directory)? {
        if let Ok(fd) = entry?.file_name().to_string_lossy().parse::<i32>() {
            if fd > 2 {
                descriptors.push(fd);
            }
        }
    }
    for fd in descriptors {
        if unsafe { libc::close(fd) } == -1 {
            let error = std::io::Error::last_os_error();
            // read_dir has already closed its own descriptor. Do not retry close after EINTR.
            if error.raw_os_error() != Some(libc::EBADF) {
                return Err(error);
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
pub fn close_inherited_fds() -> std::io::Result<()> { Ok(()) }

