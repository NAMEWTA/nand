//! A shell may start only after its waiting host belongs to this terminal's job.
//! This avoids the assign-after-spawn race without modifying portable-pty.
use portable_pty::{Child, CommandBuilder};
use std::{
    ffi::OsString,
    io,
    os::windows::{
        ffi::OsStrExt,
        io::{AsRawHandle, FromRawHandle, OwnedHandle},
    },
    process::Command,
};
use windows_sys::Win32::{
    Foundation::{GetLastError, ERROR_ALREADY_EXISTS, HANDLE, WAIT_OBJECT_0},
    System::{
        Console::{SetConsoleCtrlHandler, CTRL_BREAK_EVENT, CTRL_C_EVENT},
        JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
            SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        },
        Threading::{
            CreateEventW, OpenEventW, SetEvent, WaitForSingleObject, SYNCHRONIZATION_SYNCHRONIZE,
        },
    },
};

const HOST_ARGUMENT: &str = "--pty-job-host";

unsafe extern "system" fn host_control_handler(event: u32) -> i32 {
    // A custom handler belongs only to this waiting host. Unlike the NULL-handler
    // ignore flag, it does not make the real shell inherit disabled Ctrl+C.
    i32::from(event == CTRL_C_EVENT || event == CTRL_BREAK_EVENT)
}

pub(super) struct WindowsJob {
    handle: OwnedHandle,
    // Keep the named event alive even if the host has not reached OpenEventW yet.
    ready: Option<OwnedHandle>,
}

impl WindowsJob {
    fn new() -> io::Result<Self> {
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }
        let job = Self {
            handle: unsafe { OwnedHandle::from_raw_handle(handle) },
            ready: None,
        };
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let success = unsafe {
            SetInformationJobObject(
                job.handle.as_raw_handle(),
                JobObjectExtendedLimitInformation,
                (&limits as *const _) as _,
                std::mem::size_of_val(&limits) as u32,
            )
        };
        if success == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(job)
    }

    pub(super) fn terminate(&self) -> io::Result<()> {
        if unsafe { TerminateJobObject(self.handle.as_raw_handle(), 1) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
}

pub(super) struct WindowsLaunch {
    job: WindowsJob,
}

impl WindowsLaunch {
    pub(super) fn prepare(command: &mut CommandBuilder) -> io::Result<Self> {
        // Preserve native init failure for a missing shell, rather than admit a
        // host which cannot launch its target. Use this command's PATH and cwd.
        let cwd = command
            .get_cwd()
            .cloned()
            .unwrap_or(std::env::current_dir()?.into_os_string());
        let program = which::which_in(&command.get_argv()[0], command.get_env("PATH"), &cwd)
            .map_err(|error| io::Error::new(io::ErrorKind::NotFound, error))?;
        command.get_argv_mut()[0] = program.into_os_string();
        let mut job = WindowsJob::new()?;
        let name = format!("Local\\NAND-PTY-{}", uuid::Uuid::new_v4());
        let wide: Vec<u16> = OsString::from(&name).encode_wide().chain(Some(0)).collect();
        let handle = unsafe { CreateEventW(std::ptr::null(), 1, 0, wide.as_ptr()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }
        let ready = unsafe { OwnedHandle::from_raw_handle(handle) };
        if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "PTY launch event exists",
            ));
        }
        let mut arguments = vec![
            std::env::current_exe()?.into_os_string(),
            HOST_ARGUMENT.into(),
            name.into(),
        ];
        arguments.extend(command.get_argv().iter().cloned());
        *command.get_argv_mut() = arguments;
        job.ready = Some(ready);
        Ok(Self { job })
    }

    pub(super) fn admit(self, child: &mut dyn Child) -> io::Result<WindowsJob> {
        let process = match child.as_raw_handle() {
            Some(handle) => handle as HANDLE,
            None => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(io::Error::other("PTY host has no process handle"));
            }
        };
        // The waiting host cannot create a shell or descendants before this succeeds.
        if unsafe { AssignProcessToJobObject(self.job.handle.as_raw_handle(), process) } == 0 {
            let error = io::Error::last_os_error();
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        if unsafe {
            SetEvent(
                self.job
                    .ready
                    .as_ref()
                    .expect("launch owns its ready event")
                    .as_raw_handle(),
            )
        } == 0
        {
            let error = io::Error::last_os_error();
            let _ = self.job.terminate();
            return Err(error);
        }
        Ok(self.job)
    }
}

/// Private subprocess mode. It inherits the PTY, cwd and complete environment.
pub(crate) fn run_job_host() -> Option<i32> {
    let mut arguments = std::env::args_os().skip(1);
    if arguments.next().as_deref() != Some(std::ffi::OsStr::new(HOST_ARGUMENT)) {
        return None;
    }
    let result = (|| -> io::Result<i32> {
        if unsafe { SetConsoleCtrlHandler(Some(host_control_handler), 1) } == 0 {
            return Err(io::Error::last_os_error());
        }
        let name = arguments
            .next()
            .ok_or_else(|| io::Error::other("PTY launch event missing"))?;
        let program = arguments
            .next()
            .ok_or_else(|| io::Error::other("PTY shell missing"))?;
        let wide: Vec<u16> = name.encode_wide().chain(Some(0)).collect();
        let handle = unsafe { OpenEventW(SYNCHRONIZATION_SYNCHRONIZE, 0, wide.as_ptr()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }
        let ready = unsafe { OwnedHandle::from_raw_handle(handle) };
        if unsafe { WaitForSingleObject(ready.as_raw_handle(), 30000) } != WAIT_OBJECT_0 {
            return Err(io::Error::other("PTY job admission timed out"));
        }
        Ok(Command::new(program)
            .args(arguments)
            .status()?
            .code()
            .unwrap_or(1))
    })();
    Some(match result {
        Ok(code) => code,
        Err(error) => {
            eprintln!("PTY shell launch failed: {error}");
            1
        }
    })
}
