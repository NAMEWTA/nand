// PTY module
// Provides terminal session management

mod session;
mod flow;
use flow::{OutputCredits, OUTPUT_BATCH};
mod shell;
mod osc_scanner;
#[cfg(windows)]
mod windows_job;
#[cfg(windows)]
pub(crate) use windows_job::run_job_host;

pub use session::{PtySession, PtyReader, PtyWriter};
pub use shell::{get_shell_by_type, get_default_shell};

use crate::router::{ModuleHandler, ModuleMessage, ModuleType, RouterError, ServerResponse};
use crate::pty::osc_scanner::{OscEvent, OscScanner};
use crate::server::WsSender;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as TokioMutex;
use tokio::time::{self, Duration, Instant};
use tokio_tungstenite::tungstenite::Message;
use futures_util::SinkExt;
use uuid::Uuid;

/// Logging macros
macro_rules! log_info {
    ($($arg:tt)*) => {
        eprintln!("[INFO] [PTY] {}", format!($($arg)*));
    };
}

macro_rules! log_error {
    ($($arg:tt)*) => {
        eprintln!("[ERROR] [PTY] {}", format!($($arg)*));
    };
}

macro_rules! log_debug {
    ($($arg:tt)*) => {
        if cfg!(debug_assertions) {
            eprintln!("[DEBUG] [PTY] {}", format!($($arg)*));
        }
    };
}

// ============================================================================
// PTY session context
// ============================================================================

/// Context for a single PTY session
///
/// Contains all resources required for one PTY session
struct PtySessionContext {
    /// PTY session
    session: Arc<TokioMutex<PtySession>>,
    /// PTY writer
    input: tokio::sync::mpsc::Sender<Vec<u8>>,
    credits: Arc<OutputCredits>,
    /// Read task handle
    read_task: Option<tokio::task::JoinHandle<()>>,
}

impl PtySessionContext {
    /// Create a new session context
    fn new(
        session: Arc<TokioMutex<PtySession>>,
        writer: Arc<Mutex<PtyWriter>>,
    ) -> Self {
        let (input, mut receiver) = tokio::sync::mpsc::channel::<Vec<u8>>(32);
        tokio::task::spawn_blocking(move || {
            while let Some(data) = receiver.blocking_recv() {
                let Ok(mut writer) = writer.lock() else { break; };
                if writer.write(&data).is_err() { break; }
            }
        });
        Self {
            session,
            input,
            credits: Arc::new(OutputCredits::new()),
            read_task: None,
        }
    }
}

// ============================================================================
// PTY handler
// ============================================================================

/// PTY module handler
///
/// Manages the lifecycle of multiple PTY sessions and handles terminal-related messages
pub struct PtyHandler {
    /// Session registry: session_id -> PtySessionContext
    sessions: TokioMutex<HashMap<String, PtySessionContext>>,
    /// WebSocket sender (used to send PTY output)
    ws_sender: TokioMutex<Option<WsSender>>,
}

impl PtyHandler {
    /// Create a new PTY handler
    pub fn new() -> Self {
        Self {
            sessions: TokioMutex::new(HashMap::new()),
            ws_sender: TokioMutex::new(None),
        }
    }
    
    /// Set the WebSocket sender
    pub async fn set_ws_sender(&self, sender: WsSender) {
        let mut ws_sender = self.ws_sender.lock().await;
        *ws_sender = Some(sender);
    }
    
    /// Handle the init message and create a PTY session
    async fn handle_init(
        &self,
        shell_type: Option<String>,
        shell_args: Option<Vec<String>>,
        cwd: Option<String>,
        env: Option<HashMap<String, String>>,
        cols: Option<u16>,
        rows: Option<u16>,
    ) -> Result<Option<ServerResponse>, RouterError> {
        if self.sessions.lock().await.len() >= 64 { return Err(RouterError::ModuleError("Session limit reached".into())); }
        // Generate a unique session_id
        let session_id = Uuid::new_v4().to_string();
        let cols = cols.filter(|value| *value > 0).unwrap_or(80);
        let rows = rows.filter(|value| *value > 0).unwrap_or(24);
        
        log_info!(
            "初始化 PTY 会话: session_id={}, shell_type={:?}, cwd={:?}, size={}x{}",
            session_id,
            shell_type,
            cwd,
            cols,
            rows
        );
        
        // Create the PTY session
        let launch_shell = shell_type.clone();
        let (pty_session, pty_reader, pty_writer) = tokio::task::spawn_blocking(move || {
            PtySession::new(cols, rows, launch_shell.as_deref(),
                shell_args.as_ref().map(|v| v.as_slice()), cwd.as_deref(), env.as_ref())
                .map_err(|error| error.to_string())
        }).await.map_err(|error| RouterError::ModuleError(error.to_string()))?
            .map_err(|e| RouterError::ModuleError(format!("创建 PTY 会话失败: {}", e)))?;
        
        // Create the session context
        let pty_session = Arc::new(TokioMutex::new(pty_session));
        let pty_reader = Arc::new(Mutex::new(pty_reader));
        let pty_writer = Arc::new(Mutex::new(pty_writer));

        let mut context = PtySessionContext::new(
            Arc::clone(&pty_session),
            Arc::clone(&pty_writer),
        );
        
        // Deliver identity before any output/exit, including immediately exiting commands.
        let response = ServerResponse::new(ModuleType::Pty, "init_complete", serde_json::json!({
            "success": true, "session_id": session_id, "exit_status": true
        }));
        let sender = self.ws_sender.lock().await.clone().ok_or_else(|| RouterError::ModuleError("WebSocket sender not set".into()))?;
        // Pump output before sending identity, but gate all delivery until identity
        // succeeds. If sending fails, the pump discards output while Drop closes
        // the owned job and ConPTY; no pipe can fill and block console teardown.
        let (start_tx, start_rx) = tokio::sync::oneshot::channel();
        let read_task = self.start_read_task(session_id.clone(), pty_reader, pty_writer,
            shell_type, Arc::clone(&pty_session), start_rx, Arc::clone(&context.credits)).await?;
        context.read_task = Some(read_task);
        sender.lock().await.send(Message::Text(response.to_json().into())).await
            .map_err(|error| RouterError::ModuleError(error.to_string()))?;
        
        // Store the session context
        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(session_id.clone(), context);
        }
        let _ = start_tx.send(());
        
        log_info!("PTY 会话创建成功: session_id={}", session_id);
        
        Ok(None)
    }
    
    /// Start the PTY output reader task
    ///
    /// Returns the task handle, which the caller stores
    async fn start_read_task(
        &self,
        session_id: String,
        reader: Arc<Mutex<PtyReader>>,
        _writer: Arc<Mutex<PtyWriter>>,
        _shell_type: Option<String>,
        child_session: Arc<TokioMutex<PtySession>>,
        start_rx: tokio::sync::oneshot::Receiver<()>,
        credits: Arc<OutputCredits>,
    ) -> Result<tokio::task::JoinHandle<()>, RouterError> {
        const OUTPUT_BATCH_INTERVAL_MS: u64 = 4;
        const READ_BUFFER_SIZE: usize = 8192;

        let ws_sender = {
            let ws_sender_guard = self.ws_sender.lock().await;
            ws_sender_guard.clone()
        };
        
        let ws_sender = ws_sender.ok_or_else(|| RouterError::ModuleError("WebSocket sender not set".to_string()))?;
        
        // Start the reader task
        let task = tokio::spawn(async move {
            enum ReadEvent {
                Data(Vec<u8>),
                Eof,
                Error(String),
            }

            let (read_tx, mut read_rx) = tokio::sync::mpsc::channel::<ReadEvent>(32);
            let reader_for_thread = Arc::clone(&reader);

            tokio::task::spawn_blocking(move || {
                let mut forwarding = true;
                loop {
                    let mut reader = match reader_for_thread.lock() {
                        Ok(guard) => guard,
                        Err(_) => break,
                    };
                    let mut local_buf = vec![0u8; READ_BUFFER_SIZE];
                    match reader.read(&mut local_buf) {
                        Ok(0) => {
                            let _ = read_tx.blocking_send(ReadEvent::Eof);
                            break;
                        }
                        Ok(n) => {
                            local_buf.truncate(n);
                            if forwarding && read_tx.blocking_send(ReadEvent::Data(local_buf)).is_err() {
                                // The client went away. Continue draining until
                                // console closure, without retaining a dead receiver.
                                forwarding = false;
                            }
                        }
                        Err(e) => {
                            let _ = read_tx.blocking_send(ReadEvent::Error(e.to_string()));
                            break;
                        }
                    }
                }
            });
            if start_rx.await.is_err() { return; }

            let mut batch_buffer: Vec<u8> = Vec::new();
            let mut osc_scanner = OscScanner::new();
            let mut pending_shell_events: Vec<OscEvent> = Vec::new();
            #[cfg(windows)]
            let mut exit_poll = time::interval(Duration::from_millis(10));
            #[cfg(windows)]
            let mut observed_exit = None;

            loop {
                let first_event = {
                    #[cfg(windows)]
                    {
                        tokio::select! {
                            event = read_rx.recv() => match event {
                                Some(event) => event,
                                None => break,
                            },
                            _ = exit_poll.tick(), if observed_exit.is_none() => {
                                let mut session = child_session.lock().await;
                                match session.exit_code() {
                                    Ok(Some(code)) => {
                                        observed_exit = Some(code);
                                        let resources = session.take_windows_resources();
                                        drop(session);
                                        // ConPTY keeps its output pipe open until ClosePseudoConsole.
                                        // Close off the reactor while this task continues draining data;
                                        // EOF, rather than a quiet-period timer, marks the final output.
                                        tokio::task::spawn_blocking(move || drop(resources));
                                    }
                                    Ok(None) => {}
                                    Err(error) => { log_error!("查询 PTY 退出状态失败: {}", error); }
                                }
                                continue;
                            }
                        }
                    }
                    #[cfg(not(windows))]
                    match read_rx.recv().await {
                        Some(event) => event,
                        None => break,
                    }
                };

                let mut pending_exit = false;
                let mut pending_error: Option<String> = None;

                match first_event {
                    ReadEvent::Data(data) => {
                        pending_shell_events.extend(osc_scanner.scan(&data));
                        batch_buffer.extend_from_slice(&data);
                    }
                    ReadEvent::Eof => pending_exit = true,
                    ReadEvent::Error(e) => pending_error = Some(e),
                }

                if pending_error.is_none() && !pending_exit {
                    let deadline = Instant::now() + Duration::from_millis(OUTPUT_BATCH_INTERVAL_MS);
                    while batch_buffer.len() < OUTPUT_BATCH {
                        match time::timeout_at(deadline, read_rx.recv()).await {
                            Ok(Some(ReadEvent::Data(data))) => {
                                pending_shell_events.extend(osc_scanner.scan(&data));
                                batch_buffer.extend_from_slice(&data);
                            }
                            Ok(Some(ReadEvent::Eof)) => {
                                pending_exit = true;
                                break;
                            }
                            Ok(Some(ReadEvent::Error(e))) => {
                                pending_error = Some(e);
                                break;
                            }
                            Ok(None) => {
                                break;
                            }
                            Err(_) => {
                                break;
                            }
                        }
                    }
                }

                if !batch_buffer.is_empty() {
                    log_debug!(
                        "读取 PTY 输出(批处理): session_id={}, {} 字节",
                        session_id,
                        batch_buffer.len()
                    );

                    if !credits.reserve(batch_buffer.len()).await { break; }
                    // Build a binary frame prefixed with the session_id
                    // Format: [session_id_length: u8][session_id: bytes][data: bytes]
                    let session_id_bytes = session_id.as_bytes();
                    let session_id_len = session_id_bytes.len() as u8;

                    let mut frame = Vec::with_capacity(1 + session_id_bytes.len() + batch_buffer.len());
                    frame.push(session_id_len);
                    frame.extend_from_slice(session_id_bytes);
                    frame.extend_from_slice(&batch_buffer);

                    let mut sender = ws_sender.lock().await;
                    if let Err(e) = sender.send(Message::Binary(frame.into())).await {
                        log_error!("发送 PTY 输出失败: session_id={}, {}", session_id, e);
                        break;
                    }
                }

                if !pending_shell_events.is_empty() {
                    for event in pending_shell_events.drain(..) {
                        let event_payload = serde_json::json!({
                            "session_id": session_id,
                            "event": event.event_name(),
                            "source": event.source_name(),
                            "exit_code": event.exit_code(),
                        });
                        let response = ServerResponse::new(
                            ModuleType::Pty,
                            "shell_event",
                            event_payload,
                        );
                        let mut sender = ws_sender.lock().await;
                        if let Err(e) = sender.send(Message::Text(response.to_json().into())).await {
                            log_error!("发送 shell_event 失败: session_id={}, {}", session_id, e);
                            break;
                        }
                    }
                }

                batch_buffer.clear();

                if let Some(e) = pending_error {
                    log_error!("PTY 输出读取错误: session_id={}, {}", session_id, e);
                    pending_exit = true;
                }

                if pending_exit {
                    // EOF: the process has exited
                    log_info!("PTY 输出结束: session_id={}", session_id);

                    // Reap the actual child. A PTY EOF can precede waitability briefly.
                    let mut code: i64 = -1;
                    #[cfg(windows)]
                    if let Some(status) = observed_exit { code = i64::from(status); }
                    if code == -1 {
                        for _ in 0..100 {
                            match child_session.lock().await.exit_code() {
                                Ok(Some(status)) => { code = i64::from(status); break; }
                                Err(_) => break,
                                Ok(None) => {}
                            }
                            time::sleep(Duration::from_millis(10)).await;
                        }
                    }
                    // Send the exit event
                    let exit_response = ServerResponse::new(
                        ModuleType::Pty,
                        "exit",
                        serde_json::json!({
                            "session_id": session_id,
                            "code": code
                        }),
                    );
                    let mut sender = ws_sender.lock().await;
                    if let Err(e) = sender.send(Message::Text(exit_response.to_json().into())).await {
                        log_error!("发送 exit 事件失败: session_id={}, {}", session_id, e);
                    }
                    break;
                }
            }
        });
        
        Ok(task)
    }
    
    /// Handle the resize message and resize the terminal
    async fn handle_resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<Option<ServerResponse>, RouterError> {
        log_info!("调整终端尺寸: session_id={}, {}x{}", session_id, cols, rows);
        
        let session = self.sessions.lock().await.get(session_id).map(|context| Arc::clone(&context.session))
            .ok_or_else(|| RouterError::ModuleError(format!("SESSION_NOT_FOUND: {}", session_id)))?;
        tokio::task::spawn_blocking(move || session.blocking_lock().resize(cols, rows).map_err(|error| error.to_string())).await
            .map_err(|error| RouterError::ModuleError(error.to_string()))?
            .map_err(RouterError::ModuleError)?;
        
        Ok(None) // resize does not require a response
    }
    
    /// Write data to the PTY for the specified session
    pub async fn write_data(&self, session_id: &str, data: &[u8]) -> Result<(), RouterError> {
        if data.len() > 8192 { return Err(RouterError::ModuleError("PTY input frame exceeds 8192 bytes".into())); }
        let input = self.sessions.lock().await.get(session_id)
            .map(|context| context.input.clone())
            .ok_or_else(|| RouterError::ModuleError(format!("SESSION_NOT_FOUND: {}", session_id)))?;
        input.try_send(data.to_vec()).map_err(|e| RouterError::ModuleError(format!("PTY input queue unavailable: {}", e)))?;
        
        Ok(())
    }
    
    /// Destroy the specified session
    pub async fn handle_destroy(&self, session_id: &str) -> Result<(), RouterError> {
        log_info!("销毁 PTY 会话: session_id={}", session_id);
        
        let context = self.sessions.lock().await.remove(session_id);
        if let Some(mut context) = context {
            context.credits.close();
            let session = Arc::clone(&context.session);
            let result = tokio::task::spawn_blocking(move || session.blocking_lock().kill().map_err(|error| error.to_string())).await
                .map_err(|error| RouterError::ModuleError(error.to_string()))?;
            if let Err(error) = result {
                self.sessions.lock().await.insert(session_id.to_owned(), context);
                return Err(RouterError::ModuleError(error));
            }
            if let Some(task) = context.read_task.take() { tokio::spawn(async move { let _ = task.await; }); }
        }
        Ok(())
    }
    
    /// Clean up all sessions (called when the connection closes)
    pub async fn cleanup_all(&self) {
        log_info!("清理所有 PTY 会话");
        
        let mut sessions = self.sessions.lock().await;
        let contexts: Vec<_> = sessions.drain().collect();
        drop(sessions);
        for (session_id, mut context) in contexts {
            context.credits.close();
            log_info!("清理会话: {}", session_id);
            
            // Terminate the PTY process
            let session = context.session.clone();
            let _ = tokio::task::spawn_blocking(move || {
                let _ = session.blocking_lock().kill();
            }).await;
            
            // Wait for the reader task to finish
            if let Some(task) = context.read_task.take() {
                let _ = task.await;
            }
        }
        
        log_info!("所有 PTY 会话已清理");
    }
    
    /// Check whether any sessions are active
    pub async fn has_sessions(&self) -> bool {
        let sessions = self.sessions.lock().await;
        !sessions.is_empty()
    }
}

impl Default for PtyHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl ModuleHandler for PtyHandler {
    fn module_type(&self) -> ModuleType {
        ModuleType::Pty
    }
    
    async fn handle(&self, msg: &ModuleMessage) -> Result<Option<ServerResponse>, RouterError> {
        log_debug!("处理 PTY 消息: {}", msg.msg_type);
        
        match msg.msg_type.as_str() {
            "init" => {
                let shell_type: Option<String> = msg.get_field("shell_type");
                let shell_args: Option<Vec<String>> = msg.get_field("shell_args");
                let cwd: Option<String> = msg.get_field("cwd");
                let env: Option<HashMap<String, String>> = msg.get_field("env");
                let cols: Option<u16> = msg.get_field("cols");
                let rows: Option<u16> = msg.get_field("rows");
                
                self.handle_init(shell_type, shell_args, cwd, env, cols, rows).await
            }
            "consumed" => {
                let id: String = msg.get_field("session_id").ok_or_else(|| RouterError::ModuleError("SESSION_ID_REQUIRED".into()))?;
                let bytes: usize = msg.get_field("bytes").unwrap_or(0);
                if let Some(context) = self.sessions.lock().await.get(&id) {
                    context.credits.consumed(bytes).map_err(|e| RouterError::ModuleError(e.into()))?;
                }
                Ok(None)
            }
            "resize" => {
                // resize requires a session_id
                let session_id: Option<String> = msg.get_field("session_id");
                let session_id = session_id.ok_or_else(|| {
                    RouterError::ModuleError("SESSION_ID_REQUIRED".to_string())
                })?;
                
                let cols: u16 = msg.get_field("cols").unwrap_or(80);
                let rows: u16 = msg.get_field("rows").unwrap_or(24);
                
                self.handle_resize(&session_id, cols, rows).await
            }
            "destroy" => {
                // destroy requires a session_id
                let session_id: Option<String> = msg.get_field("session_id");
                let session_id = session_id.ok_or_else(|| {
                    RouterError::ModuleError("SESSION_ID_REQUIRED".to_string())
                })?;
                
                self.handle_destroy(&session_id).await?;
                Ok(None)
            }
            "env" => {
                // In the original implementation, the env command only logged data; actual environment variables are set during init
                let cwd: Option<String> = msg.get_field("cwd");
                let env: Option<HashMap<String, String>> = msg.get_field("env");
                log_info!("收到 env 命令: cwd={:?}, env={:?}", cwd, env);
                Ok(None)
            }
            _ => {
                log_debug!("未知的 PTY 消息类型: {}", msg.msg_type);
                Err(RouterError::ModuleError(format!("未知的 PTY 消息类型: {}", msg.msg_type)))
            }
        }
    }
}
