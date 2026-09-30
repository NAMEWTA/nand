// PTY session management

use portable_pty::{native_pty_system, Child, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

/// PTY session
pub struct PtySession {
    master: Option<Box<dyn MasterPty + Send>>,
    #[cfg(windows)]
    job: Option<super::windows_job::WindowsJob>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

// Drop the job first to stop all owned descendants, then close and drain ConPTY.
// Closing the pseudoconsole can block, so callers drop this off the async reactor.
#[cfg(windows)]
pub(super) struct WindowsResources {
    _job: Option<super::windows_job::WindowsJob>,
    _master: Option<Box<dyn MasterPty + Send>>,
}

#[cfg(windows)]
impl Drop for PtySession {
    fn drop(&mut self) {
        let resources = self.take_windows_resources();
        if resources._job.is_some() || resources._master.is_some() {
            // Covers initialization/send failures too. Never run ClosePseudoConsole
            // while dropping a context on the current-thread async runtime.
            std::thread::spawn(move || drop(resources));
        }
    }
}

/// PTY reader (independent, no lock required)
pub struct PtyReader {
    reader: Box<dyn Read + Send>,
}

/// PTY writer (independent, no lock required)
pub struct PtyWriter {
    writer: Box<dyn Write + Send>,
}

impl PtySession {
    /// Create a new PTY session and return (session, reader, writer)
    /// 
    /// # Parameters
    /// - `cols`: Terminal column count
    /// - `rows`: Terminal row count
    /// - `shell_type`: Optional shell type (cmd, powershell, wsl, bash, zsh, tmux, custom:/path)
    /// - `shell_args`: Optional shell startup arguments
    /// - `cwd`: Optional working directory
    /// - `env`: Optional environment variables
    pub fn new(
        cols: u16, 
        rows: u16, 
        shell_type: Option<&str>,
        shell_args: Option<&[String]>,
        cwd: Option<&str>,
        env: Option<&std::collections::HashMap<String, String>>
    ) -> Result<(Self, PtyReader, PtyWriter), Box<dyn std::error::Error>> {
        // Get the PTY system
        let pty_system = native_pty_system();
        
        // Create the PTY pair
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        
        // Get the command for the requested shell type
        let mut cmd = super::shell::get_shell_by_type(shell_type);
        
        // Add startup arguments
        if let Some(args) = shell_args {
            for arg in args {
                cmd.arg(arg);
            }
        }
        
        // Set the working directory
        if let Some(cwd_path) = cwd {
            cmd.cwd(cwd_path);
        }
        
        // Set environment variables
        // Ensure the TERM environment variable exists, otherwise commands like clear and vim will not work correctly
        let term_value = env
            .and_then(|e| e.get("TERM").cloned())
            .or_else(|| std::env::var("TERM").ok())
            .unwrap_or_else(|| "xterm-256color".to_string());
        cmd.env("TERM", term_value);
        
        // Set UTF-8 locale environment variables so non-ASCII characters display correctly
        // Priority: user-provided value > system environment variable > UTF-8 default value
        let locale_vars = ["LANG", "LC_ALL", "LC_CTYPE"];
        for var in &locale_vars {
            let value = env
                .and_then(|e| e.get(*var).cloned())
                .or_else(|| std::env::var(*var).ok())
                .unwrap_or_else(|| {
                    // Use en_US.UTF-8 by default on macOS/Linux to support UTF-8 encoding
                    "en_US.UTF-8".to_string()
                });
            cmd.env(*var, value);
        }
        
        // Set other custom environment variables
        if let Some(env_vars) = env {
            for (key, value) in env_vars {
                // Skip environment variables that were already handled
                if key != "TERM" && !locale_vars.contains(&key.as_str()) {
                    cmd.env(key, value);
                }
            }
        }
        // Start the shell process
        #[cfg(windows)]
        let launch = super::windows_job::WindowsLaunch::prepare(&mut cmd)?;
        #[allow(unused_mut)]
        let mut child = pair.slave.spawn_command(cmd)?;
        #[cfg(windows)]
        let job = launch.admit(child.as_mut())?;
        
        // Get the reader and writer (independent, no lock required)
        let reader = PtyReader {
            reader: pair.master.try_clone_reader()?,
        };
        let writer = PtyWriter {
            writer: pair.master.take_writer()?,
        };
        
        let session = Self {
            master: Some(pair.master),
            #[cfg(windows)]
            job: Some(job),
            child: Arc::new(Mutex::new(child)),
        };
        
        Ok((session, reader, writer))
    }

    /// Nonblocking child status. EOF alone does not imply a successful exit.
    pub fn exit_code(&self) -> Result<Option<u32>, String> {
        let mut child = self.child.lock().map_err(|e| e.to_string())?;
        child.try_wait().map(|status| status.map(|s| s.exit_code())).map_err(|e| e.to_string())
    }

    /// Resize the PTY
    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<(), Box<dyn std::error::Error>> {
        self.master.as_ref().ok_or("PTY process exited")?.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }
    
    /// Terminate the child process
    pub fn kill(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        #[cfg(windows)]
        {
            if let Some(job) = &self.job { job.terminate()?; }
            return Ok(());
        }
        #[cfg(not(windows))]
        if let Ok(mut child) = self.child.lock() {
            child.kill()?;
        }
        #[cfg(not(windows))]
        Ok(())
    }

    #[cfg(windows)]
    pub(super) fn take_windows_resources(&mut self) -> WindowsResources {
        WindowsResources { _job: self.job.take(), _master: self.master.take() }
    }
}

impl PtyReader {
    /// Read data from the PTY
    pub fn read(&mut self, buf: &mut [u8]) -> Result<usize, Box<dyn std::error::Error>> {
        let n = self.reader.read(buf)?;
        Ok(n)
    }
}

impl PtyWriter {
    /// Write data to the PTY
    pub fn write(&mut self, data: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
        self.writer.write_all(data)?;
        self.writer.flush()?;
        Ok(())
    }
}
