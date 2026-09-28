//! Native history stays read-only. Expensive parsing runs outside the PTY reactor.
//! Formats checked against stablyai/orca 27b823f (MIT, Lovecast Inc.).
use crate::{
    router::{ModuleHandler, ModuleMessage, ModuleType, RouterError, ServerResponse},
    server::WsSender,
};
use futures_util::SinkExt;
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, UNIX_EPOCH},
};

#[derive(Clone, Serialize, Deserialize, Default, Debug)]
#[serde(rename_all = "camelCase")]
struct Usage {
    input: u64,
    output: u64,
    cache_read: u64,
    cache_write: u64,
    cost: Option<f64>,
    known: bool,
    #[serde(default)]
    partial: bool,
}
#[derive(Clone, Serialize, Deserialize, Default, Debug)]
#[serde(rename_all = "camelCase")]
struct Session {
    key: String,
    agent_id: String,
    account_key: String,
    session_id: String,
    cwd: String,
    title: String,
    transcript_path: String,
    modified_at_ms: u64,
    text: String,
    usage: Usage,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Root {
    agent_id: String,
    path: String,
    account_key: String,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Request {
    vault: String,
    index: String,
    #[serde(default)]
    roots: Vec<Root>,
    #[serde(default)]
    query: String,
    #[serde(default)]
    metadata: HashMap<String, Value>,
    #[serde(default)]
    filter: String,
    #[serde(default)]
    offset: usize,
    #[serde(default)]
    key: String,
}
pub struct AgentData {
    sender: tokio::sync::Mutex<Option<WsSender>>,
    jobs: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    gate: Arc<tokio::sync::Semaphore>,
}
impl AgentData {
    pub fn new() -> Self {
        Self {
            gate: Arc::new(tokio::sync::Semaphore::new(1)),
            sender: tokio::sync::Mutex::new(None),
            jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    pub async fn set_ws_sender(&self, sender: WsSender) {
        *self.sender.lock().await = Some(sender);
    }
}
#[async_trait::async_trait]
impl ModuleHandler for AgentData {
    fn module_type(&self) -> ModuleType {
        ModuleType::AgentData
    }
    async fn handle(&self, msg: &ModuleMessage) -> Result<Option<ServerResponse>, RouterError> {
        let id = msg
            .get_field::<String>("requestId")
            .ok_or_else(|| RouterError::InvalidMessage("requestId".into()))?;
        if msg.msg_type == "cancel" {
            if let Some(flag) = self.jobs.lock().unwrap().get(&id) {
                flag.store(true, Ordering::Relaxed);
            }
            return Ok(None);
        }
        let request: Request = serde_json::from_value(msg.payload.clone())?;
        let operation = msg.msg_type.clone();
        let flag = Arc::new(AtomicBool::new(false));
        self.jobs.lock().unwrap().insert(id.clone(), flag.clone());
        let sender = self.sender.lock().await.clone();
        let gate = self.gate.clone();
        let jobs = self.jobs.clone();
        tokio::spawn(async move {
            let permit = gate.acquire_owned().await;
            let result =
                tokio::task::spawn_blocking(move || execute(&operation, &request, &flag)).await;
            drop(permit);
            jobs.lock().unwrap().remove(&id);
            let payload = match result {
                Ok(Ok(data)) => json!({"requestId": id, "data": data}),
                Ok(Err(error)) => json!({"requestId": id, "error": error}),
                Err(error) => json!({"requestId": id, "error": error.to_string()}),
            };
            if let Some(sender) = sender {
                let response = ServerResponse::new(ModuleType::AgentData, "result", payload);
                let _ = sender
                    .lock()
                    .await
                    .send(tokio_tungstenite::tungstenite::Message::Text(
                        response.to_json().into(),
                    ))
                    .await;
            }
        });
        Ok(None)
    }
}
fn execute(operation: &str, request: &Request, cancel: &AtomicBool) -> Result<Value, String> {
    let vault = fs::canonicalize(&request.vault).map_err(|e| e.to_string())?;
    // Resolve the vault once, then anchor its relative index path to that same
    // representation. Node and Rust differ on Windows verbatim prefixes, and
    // macOS may spell the same directory through /var or /private/var.
    let supplied_index = Path::new(&request.index);
    let relative_index = supplied_index
        .strip_prefix(Path::new(&request.vault))
        .or_else(|_| supplied_index.strip_prefix(&vault))
        .map_err(|_| "index outside vault")?;
    let index = vault.join(relative_index);
    // Index writes are confined to this vault's NAND data area.
    let parent = index.parent().ok_or("index path")?;
    if !parent.starts_with(vault.join(".nand"))
        || parent
            .components()
            .any(|c| c == std::path::Component::ParentDir)
    {
        return Err("index outside vault".into());
    }
    // Check existing ancestors before mkdir, including a symlinked .nand directory.
    let existing = parent
        .ancestors()
        .find(|p| p.exists())
        .ok_or("index path")?;
    if !fs::canonicalize(existing)
        .map_err(|e| e.to_string())?
        .starts_with(&vault)
    {
        return Err("index outside vault".into());
    }
    if fs::symlink_metadata(&index).is_ok_and(|m| m.file_type().is_symlink()) {
        return Err("symlinked index".into());
    }
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    if !fs::canonicalize(parent)
        .map_err(|e| e.to_string())?
        .starts_with(&vault)
    {
        return Err("index outside vault".into());
    }
    let db = Connection::open(&index).map_err(|e| e.to_string())?;
    db.busy_timeout(Duration::from_secs(2))
        .map_err(|e| e.to_string())?;
    db.execute_batch("CREATE TABLE IF NOT EXISTS history (key TEXT PRIMARY KEY, source TEXT NOT NULL, stamp TEXT NOT NULL, data TEXT NOT NULL, body TEXT NOT NULL, modified INTEGER NOT NULL);").map_err(|e| e.to_string())?;
    if operation == "scan" {
        let mut warnings = Vec::new();
        for root in &request.roots {
            if cancel.load(Ordering::Relaxed) {
                return Err("cancelled".into());
            }
            let path = Path::new(&root.path);
            if !path.exists() {
                continue;
            }
            if root.agent_id == "opencode" && path.extension().is_some_and(|e| e == "db") {
                match opencode(path, root, &vault, cancel) {
                    Ok(rows) => {
                        for row in rows {
                            save(&db, &row, "sqlite").map_err(|e| e.to_string())?;
                        }
                    }
                    Err(error) => warnings.push(format!("{}: {}", root.agent_id, error)),
                }
                continue;
            }
            let mut files = Vec::new();
            walk(path, &mut files, cancel, 0);
            for path in files {
                if cancel.load(Ordering::Relaxed) {
                    return Err("cancelled".into());
                }
                let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                let relevant = match root.agent_id.as_str() {
                    "grok" => name == "session.json",
                    "gemini" => {
                        path.parent().is_some_and(|p| p.ends_with("chats"))
                            && (name.ends_with(".json") || name.ends_with(".jsonl"))
                    }
                    _ => name.ends_with(".jsonl"),
                };
                if !relevant {
                    continue;
                }
                let meta = match fs::metadata(&path) {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                let modified = meta
                    .modified()
                    .ok()
                    .and_then(|v| v.duration_since(UNIX_EPOCH).ok())
                    .map(|v| v.as_millis() as u64)
                    .unwrap_or(0);
                let mut stamp = format!("{}:{}", modified, meta.len());
                let mut modified = modified;
                if root.agent_id == "grok" {
                    if let Ok(chat) = fs::metadata(path.with_file_name("chat_history.jsonl")) {
                        let at = chat
                            .modified()
                            .ok()
                            .and_then(|v| v.duration_since(UNIX_EPOCH).ok())
                            .map(|v| v.as_millis() as u64)
                            .unwrap_or(0);
                        stamp.push_str(&format!(":{}:{}", at, chat.len()));
                        modified = modified.max(at);
                    }
                }
                let source = path.to_string_lossy().to_string();
                let cached: bool = db
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM history WHERE source=?1 AND stamp=?2)",
                        params![source, stamp],
                        |r| r.get(0),
                    )
                    .unwrap_or(false);
                if cached {
                    continue;
                }
                match parse(&path, root, &vault, modified, cancel) {
                    Ok(Some(session)) => {
                        save(&db, &session, &stamp).map_err(|e| e.to_string())?;
                    }
                    Ok(None) => {}
                    Err(error) => warnings.push(format!("{}: {}", source, error)),
                }
            }
        }
        return Ok(json!({"warnings": warnings}));
    }
    if operation == "read" {
        let raw: String = db
            .query_row(
                "SELECT data FROM history WHERE key=?1",
                params![request.key],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        let session: Session = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        if !inside(&vault, &session.cwd) {
            return Err("session outside vault".into());
        }
        return Ok(json!(session));
    }
    if operation != "query" {
        return Err("unknown history operation".into());
    }
    let pattern = request.query.to_lowercase();
    let matches: Vec<&String> = request
        .metadata
        .iter()
        .filter(|(_, value)| value.to_string().to_lowercase().contains(&pattern))
        .map(|(key, _)| key)
        .collect();
    let mut statement = db
        .prepare("SELECT data FROM history WHERE instr(lower(body),?1)>0 OR key IN (SELECT value FROM json_each(?2)) ORDER BY modified DESC")
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map(
            params![pattern, serde_json::to_string(&matches).unwrap()],
            |r| r.get::<_, String>(0),
        )
        .map_err(|e| e.to_string())?;
    let mut all = Vec::new();
    let mut total_usage = Usage::default();
    let mut unknown_cost = false;
    for raw in rows {
        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".into());
        }
        if let Ok(mut row) = serde_json::from_str::<Session>(&raw.map_err(|e| e.to_string())?) {
            if !inside(&vault, &row.cwd) {
                continue;
            }
            let meta = request.metadata.get(&row.key);
            let archived = meta.and_then(|m| m["archived"].as_bool()).unwrap_or(false);
            let favorite = meta.and_then(|m| m["favorite"].as_bool()).unwrap_or(false);
            if (request.filter == "active" && archived)
                || (request.filter == "archived" && !archived)
                || (request.filter == "favorite" && !favorite)
            {
                continue;
            }
            total_usage.input += row.usage.input;
            total_usage.output += row.usage.output;
            total_usage.cache_read += row.usage.cache_read;
            total_usage.cache_write += row.usage.cache_write;
            total_usage.known |= row.usage.known;
            total_usage.partial |= !row.usage.known;
            unknown_cost |= row.usage.cost.is_none();
            if let Some(cost) = row.usage.cost {
                *total_usage.cost.get_or_insert(0.0) += cost;
            }
            row.text.clear();
            all.push(row);
        }
    }
    if unknown_cost {
        total_usage.cost = None;
    }
    let total = all.len();
    Ok(
        json!({"rows": all.into_iter().skip(request.offset).take(100).collect::<Vec<_>>(), "total": total, "usage": total_usage}),
    )
}
fn save(db: &Connection, row: &Session, stamp: &str) -> rusqlite::Result<usize> {
    db.execute(
        "INSERT OR REPLACE INTO history VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            row.key,
            row.transcript_path,
            stamp,
            serde_json::to_string(row).unwrap(),
            format!("{}\n{}\n{}", row.title, row.cwd, row.text),
            row.modified_at_ms
        ],
    )
}
fn inside(vault: &Path, cwd: &str) -> bool {
    !cwd.is_empty() && fs::canonicalize(cwd).is_ok_and(|p| p.starts_with(vault))
}
fn walk(path: &Path, files: &mut Vec<PathBuf>, cancel: &AtomicBool, depth: usize) {
    if depth > 12 || cancel.load(Ordering::Relaxed) {
        return;
    }
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let kind = match entry.file_type() {
                Ok(k) => k,
                Err(_) => continue,
            };
            if kind.is_symlink() {
                continue;
            }
            if kind.is_dir() {
                if !matches!(
                    entry.file_name().to_str(),
                    Some("subagents" | "node_modules" | ".git")
                ) {
                    walk(&entry.path(), files, cancel, depth + 1);
                }
            } else if kind.is_file() {
                files.push(entry.path());
            }
        }
    }
}
fn string(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or("").to_owned()
}
fn number(v: &Value, key: &str) -> u64 {
    v.get(key).and_then(Value::as_u64).unwrap_or(0)
}
fn content(value: &Value) -> String {
    if let Some(s) = value.as_str() {
        return s.to_owned();
    }
    if let Some(rows) = value.as_array() {
        return rows
            .iter()
            .filter_map(|v| v.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("\n");
    }
    String::new()
}
fn add_message(session: &mut Session, role: &str, text: String) {
    if text.is_empty() {
        return;
    }
    if session.title.is_empty() && role == "user" {
        session.title = text.chars().take(100).collect();
    }
    session
        .text
        .push_str(&format!("\n## {}\n\n{}\n", role, text));
}
fn consume(session: &mut Session, row: &Value, seen: &mut HashMap<String, Usage>) {
    let kind = string(row, "type");
    if kind == "session_meta" {
        let p = &row["payload"];
        session.session_id = string(p, "id");
        session.cwd = string(p, "cwd");
    }
    if kind == "session" {
        session.session_id = string(row, "id");
        session.cwd = string(row, "cwd");
    }
    if session.cwd.is_empty() {
        session.cwd = string(row, "cwd");
    }
    if session.session_id.is_empty() {
        session.session_id = string(row, "sessionId");
    }
    let title = string(row, "customTitle");
    if !title.is_empty() {
        session.title = title;
    }
    if kind == "response_item" {
        let p = &row["payload"];
        if string(p, "type") == "message" {
            add_message(session, &string(p, "role"), content(&p["content"]));
        }
    }
    let msg = if row.get("message").is_some() {
        &row["message"]
    } else {
        row
    };
    let role = string(msg, "role");
    if !role.is_empty() {
        let id = string(msg, "id");
        let text = content(&msg["content"]);
        if id.is_empty() || !seen.contains_key(&id) || !session.text.contains(&text) {
            add_message(session, &role, text);
        }
        if role == "assistant" && msg["usage"].is_object() {
            let u = &msg["usage"];
            let current = Usage {
                known: true,
                input: number(u, "input_tokens")
                    + number(u, "input")
                    + number(u, "cache_read_input_tokens")
                    + number(u, "cacheRead")
                    + number(u, "cache_creation_input_tokens")
                    + number(u, "cacheWrite"),
                output: number(u, "output_tokens") + number(u, "output"),
                cache_read: number(u, "cache_read_input_tokens") + number(u, "cacheRead"),
                cache_write: number(u, "cache_creation_input_tokens") + number(u, "cacheWrite"),
                cost: u["cost"]["total"].as_f64(),
                ..Default::default()
            };
            // Claude may append multiple content blocks/usage snapshots for one message.
            // Count that message once, accepting its later, more complete usage.
            let mut unkeyed = Usage::default();
            let previous = if id.is_empty() {
                &mut unkeyed
            } else {
                seen.entry(id).or_default()
            };
            session.usage.known = true;
            session.usage.input += current.input.saturating_sub(previous.input);
            session.usage.output += current.output.saturating_sub(previous.output);
            session.usage.cache_read += current.cache_read.saturating_sub(previous.cache_read);
            session.usage.cache_write += current.cache_write.saturating_sub(previous.cache_write);
            if let Some(cost) = current.cost {
                *session.usage.cost.get_or_insert(0.0) +=
                    (cost - previous.cost.unwrap_or(0.0)).max(0.0);
                previous.cost = Some(cost.max(previous.cost.unwrap_or(0.0)));
            }
            previous.input = previous.input.max(current.input);
            previous.output = previous.output.max(current.output);
            previous.cache_read = previous.cache_read.max(current.cache_read);
            previous.cache_write = previous.cache_write.max(current.cache_write);
        }
    }

    if kind == "event_msg" && string(&row["payload"], "type") == "token_count" {
        let u = &row["payload"]["info"]["total_token_usage"];
        if u.is_object() {
            session.usage.known = true;
            session.usage.input = number(u, "input_tokens");
            session.usage.output = number(u, "output_tokens");
            session.usage.cache_read = number(u, "cached_input_tokens");
        }
    }
}
fn gemini_cwd(path: &Path, root: &Root) -> String {
    let Some(project) = path.parent().and_then(Path::parent) else {
        return String::new();
    };
    if let Ok(cwd) = fs::read_to_string(project.join(".project_root")) {
        if !cwd.trim().is_empty() {
            return cwd.trim().into();
        }
    }
    let Some(home) = Path::new(&root.path).parent() else {
        return String::new();
    };
    let registry: Value = File::open(home.join("projects.json"))
        .ok()
        .and_then(|f| serde_json::from_reader(f).ok())
        .unwrap_or(Value::Null);
    registry["projects"]
        .as_object()
        .and_then(|rows| {
            rows.iter()
                .find(|(_, id)| id.as_str() == project.file_name().and_then(|p| p.to_str()))
                .map(|(cwd, _)| cwd.clone())
        })
        .unwrap_or_default()
}
fn consume_gemini(session: &mut Session, msg: &Value) {
    let role = string(msg, "type");
    if role != "user" && role != "gemini" {
        return;
    }
    add_message(
        session,
        if role == "gemini" {
            "assistant"
        } else {
            "user"
        },
        content(&msg["content"]),
    );
    let u = &msg["tokens"];
    if role == "gemini" && u.is_object() {
        session.usage.known = true;
        session.usage.input += number(u, "input");
        session.usage.output += number(u, "output") + number(u, "thoughts");
        session.usage.cache_read += number(u, "cached");
    }
}
fn parse(
    path: &Path,
    root: &Root,
    vault: &Path,
    modified: u64,
    cancel: &AtomicBool,
) -> Result<Option<Session>, String> {
    let mut session = Session {
        agent_id: root.agent_id.clone(),
        account_key: root.account_key.clone(),
        transcript_path: path.to_string_lossy().into(),
        modified_at_ms: modified,
        ..Default::default()
    };
    let mut seen = HashMap::new();
    if root.agent_id == "gemini" {
        session.cwd = gemini_cwd(path, root);
    }
    if root.agent_id == "grok" {
        let data: Value = serde_json::from_reader(File::open(path).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        session.cwd = string(&data["info"], "cwd");
        if !inside(vault, &session.cwd) {
            return Ok(None);
        }
        session.session_id = string(&data["info"], "id");
        session.title = string(&data, "generated_title");
        if let Ok(file) = File::open(path.with_file_name("chat_history.jsonl")) {
            for line in BufReader::new(file).lines().map_while(Result::ok) {
                if cancel.load(Ordering::Relaxed) {
                    return Err("cancelled".into());
                }
                if let Ok(row) = serde_json::from_str::<Value>(&line) {
                    let role = string(&row, "type");
                    if role == "user" || role == "assistant" {
                        add_message(&mut session, &role, content(&row["content"]));
                    }
                }
            }
        }
    } else if root.agent_id == "gemini" && path.extension().is_some_and(|s| s == "json") {
        let data: Value = serde_json::from_reader(File::open(path).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        session.session_id = string(&data, "sessionId");
        if data["cwd"].is_string() {
            session.cwd = string(&data, "cwd");
        }
        if session.cwd.is_empty() {
            if let Some(project) = path.parent().and_then(Path::parent) {
                session.cwd = fs::read_to_string(project.join(".project_root"))
                    .unwrap_or_default()
                    .trim()
                    .to_string();
            }
        }
        if let Some(messages) = data["messages"].as_array() {
            for msg in messages {
                consume_gemini(&mut session, msg);
            }
        }
    } else {
        let file = File::open(path).map_err(|e| e.to_string())?;
        for line in BufReader::new(file).lines() {
            if cancel.load(Ordering::Relaxed) {
                return Err("cancelled".into());
            }
            let line = line.map_err(|e| e.to_string())?;
            if let Ok(row) = serde_json::from_str::<Value>(&line) {
                if root.agent_id == "gemini" {
                    let id = string(&row, "sessionId");
                    if !id.is_empty() {
                        session.session_id = id;
                    }
                    consume_gemini(&mut session, &row);
                } else {
                    consume(&mut session, &row, &mut seen);
                }
                if !session.cwd.is_empty() && !inside(vault, &session.cwd) {
                    return Ok(None);
                }
            }
        }
    }
    if session.session_id.is_empty() || !inside(vault, &session.cwd) {
        return Ok(None);
    }
    if session.title.is_empty() {
        session.title = session.session_id.clone();
    }
    session.key =
        serde_json::to_string(&(&session.agent_id, &session.account_key, &session.session_id))
            .unwrap();
    Ok(Some(session))
}
fn opencode(
    path: &Path,
    root: &Root,
    vault: &Path,
    cancel: &AtomicBool,
) -> Result<Vec<Session>, String> {
    let db = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| e.to_string())?;
    db.busy_timeout(Duration::from_millis(1500))
        .map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA query_only=ON")
        .map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id,directory,title,time_updated FROM session WHERE parent_id IS NULL")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, u64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".into());
        }
        let (id, cwd, title, modified) = row.map_err(|e| e.to_string())?;
        if !inside(vault, &cwd) {
            continue;
        }
        let mut s = Session {
            key: serde_json::to_string(&("opencode", &root.account_key, &id)).unwrap(),
            agent_id: "opencode".into(),
            account_key: root.account_key.clone(),
            session_id: id.clone(),
            cwd,
            title,
            modified_at_ms: modified,
            transcript_path: path.to_string_lossy().into(),
            ..Default::default()
        };
        let mut messages = db
            .prepare("SELECT data FROM message WHERE session_id=?1 ORDER BY time_created")
            .map_err(|e| e.to_string())?;
        let raw = messages
            .query_map(params![id], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for row in raw {
            if cancel.load(Ordering::Relaxed) {
                return Err("cancelled".into());
            }
            let v: Value = serde_json::from_str(&row.map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            let u = &v["tokens"];
            if u.is_object() {
                s.usage.known = true;
                s.usage.input +=
                    number(u, "input") + number(&u["cache"], "read") + number(&u["cache"], "write");
                s.usage.output += number(u, "output") + number(u, "reasoning");
                s.usage.cache_read += number(&u["cache"], "read");
                s.usage.cache_write += number(&u["cache"], "write");
            }
            if let Some(cost) = v["cost"].as_f64() {
                *s.usage.cost.get_or_insert(0.0) += cost;
            }
        }
        let mut parts=db.prepare("SELECT part.data FROM part JOIN message ON part.message_id=message.id WHERE message.session_id=?1 ORDER BY part.time_created").map_err(|e|e.to_string())?;
        for row in parts
            .query_map(params![id], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?
        {
            if let Ok(v) = serde_json::from_str::<Value>(&row.map_err(|e| e.to_string())?) {
                if string(&v, "type") == "text" {
                    s.text.push_str(&string(&v, "text"));
                    s.text.push('\n');
                }
            }
        }
        result.push(s);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Temp(PathBuf);
    impl Temp {
        fn new() -> Self {
            let p = std::env::temp_dir().join(format!("nand-history-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&p).unwrap();
            Self(fs::canonicalize(p).unwrap())
        }
    }
    impl Drop for Temp {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn request(root: &Path, sources: Vec<Root>) -> Request {
        Request {
            vault: root.to_string_lossy().into(),
            index: root
                .join(".nand/terminal-agent/test/index.sqlite")
                .to_string_lossy()
                .into(),
            roots: sources,
            query: String::new(),
            metadata: HashMap::new(),
            filter: String::new(),
            offset: 0,
            key: String::new(),
        }
    }
    #[test]
    fn index_paths_accept_vault_aliases_but_reject_escaping_writes() {
        let temp = Temp::new();
        let outside = Temp::new();
        let cancel = AtomicBool::new(false);
        let mut req = request(&temp.0, vec![]);
        #[cfg(windows)]
        {
            // Node realpath uses drive paths; Rust canonicalize uses verbatim paths.
            req.vault = req.vault.trim_start_matches(r"\\?\").to_string();
            req.index = req.index.trim_start_matches(r"\\?\").to_string();
        }
        #[cfg(unix)]
        {
            let alias = outside.0.join("vault-alias");
            std::os::unix::fs::symlink(&temp.0, &alias).unwrap();
            req = request(&alias, vec![]);
        }
        assert_eq!(execute("query", &req, &cancel).unwrap()["total"], 0);
        req.index = outside.0.join("outside.sqlite").to_string_lossy().into();
        assert_eq!(execute("query", &req, &cancel).unwrap_err(), "index outside vault");
        assert!(!Path::new(&req.index).exists());
        req.index = Path::new(&req.vault).join(".nand/../../escape.sqlite").to_string_lossy().into();
        assert_eq!(execute("query", &req, &cancel).unwrap_err(), "index outside vault");
        #[cfg(unix)]
        {
            let linked = temp.0.join(".nand/escape");
            std::os::unix::fs::symlink(&outside.0, &linked).unwrap();
            req.index = linked.join("linked.sqlite").to_string_lossy().into();
            req.vault = temp.0.to_string_lossy().into();
            assert_eq!(execute("query", &req, &cancel).unwrap_err(), "index outside vault");
            assert!(!outside.0.join("linked.sqlite").exists());
            let source = outside.0.join("source.sqlite");
            fs::write(&source, b"preserve native file").unwrap();
            let linked = temp.0.join(".nand/linked.sqlite");
            std::os::unix::fs::symlink(&source, &linked).unwrap();
            req.index = linked.to_string_lossy().into();
            assert_eq!(execute("query", &req, &cancel).unwrap_err(), "symlinked index");
            assert_eq!(fs::read(&source).unwrap(), b"preserve native file");
        }
    }
    #[test]
    fn streams_full_transcript_and_refreshes_appends_without_rewriting_source() {
        let temp = Temp::new();
        let source = temp.0.join("native");
        fs::create_dir(&source).unwrap();
        let file = source.join("session.jsonl");
        let mut text = format!(
            "{}\n",
            json!({"type":"session_meta","payload":{"id":"one","cwd":temp.0}})
        );
        text.push_str(&format!("{}\n",json!({"type":"response_item","payload":{"type":"message","role":"user","content":[{"text":"x".repeat(200_000)}]}})));
        text.push_str(&format!("{}\n",json!({"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"text":"needle after old prefix cap"}]}})));
        text.push_str(&format!("{}\n",json!({"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":17,"output_tokens":8,"cached_input_tokens":3}}}})));
        fs::write(&file, &text).unwrap();
        let mut req = request(
            &temp.0,
            vec![Root {
                agent_id: "codex".into(),
                path: source.to_string_lossy().into(),
                account_key: "{}".into(),
            }],
        );
        let cancel = AtomicBool::new(false);
        execute("scan", &req, &cancel).unwrap();
        req.query = "needle".into();
        let page = execute("query", &req, &cancel).unwrap();
        assert_eq!(page["total"], 1);
        assert_eq!(page["usage"]["input"], 17);
        assert_eq!(fs::read_to_string(&file).unwrap(), text);
        text.push_str(&format!("{}\n",json!({"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":23,"output_tokens":10}}}})));
        fs::write(&file, &text).unwrap();
        execute("scan", &req, &cancel).unwrap();
        let page = execute("query", &req, &cancel).unwrap();
        assert_eq!(page["total"], 1);
        assert_eq!(page["usage"]["input"], 23);
    }
    #[test]
    fn scope_uses_real_directories_and_cancel_refuses_partial_scan() {
        let temp = Temp::new();
        let outside = Temp::new();
        assert!(!inside(&temp.0, &outside.0.to_string_lossy()));
        assert!(inside(&temp.0, &temp.0.to_string_lossy()));
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&outside.0, temp.0.join("escape")).unwrap();
            assert!(!inside(&temp.0, &temp.0.join("escape").to_string_lossy()));
        }
        let req = request(
            &temp.0,
            vec![Root {
                agent_id: "pi".into(),
                path: temp.0.to_string_lossy().into(),
                account_key: "{}".into(),
            }],
        );
        assert_eq!(
            execute("scan", &req, &AtomicBool::new(true)).unwrap_err(),
            "cancelled"
        );
    }
    #[test]
    fn native_formats_keep_account_identity_and_unknown_usage() {
        let temp = Temp::new();
        let root = Root {
            agent_id: "pi".into(),
            path: temp.0.to_string_lossy().into(),
            account_key: "account-A".into(),
        };
        let file = temp.0.join("pi.jsonl");
        fs::write(&file,format!("{}\n{}\n",json!({"type":"session","id":"same","cwd":temp.0}),json!({"type":"message","message":{"role":"user","content":[{"type":"text","text":"hello"}]}}))).unwrap();
        let row = parse(&file, &root, &temp.0, 0, &AtomicBool::new(false))
            .unwrap()
            .unwrap();
        assert_eq!(row.title, "hello");
        assert!(!row.usage.known);
        let other = parse(
            &file,
            &Root {
                account_key: "account-B".into(),
                ..root
            },
            &temp.0,
            0,
            &AtomicBool::new(false),
        )
        .unwrap()
        .unwrap();
        assert_ne!(row.key, other.key);
    }
    #[test]
    fn opencode_reads_database_read_only_and_excludes_children() {
        let temp = Temp::new();
        let file = temp.0.join("opencode.db");
        {
            let db = Connection::open(&file).unwrap();
            db.execute_batch("CREATE TABLE session(id TEXT,directory TEXT,title TEXT,time_updated INTEGER,parent_id TEXT); CREATE TABLE message(id TEXT,session_id TEXT,time_created INTEGER,data TEXT); CREATE TABLE part(message_id TEXT,time_created INTEGER,data TEXT);").unwrap();
            db.execute(
                "INSERT INTO session VALUES ('main',?1,'title',12,NULL)",
                params![temp.0.to_string_lossy()],
            )
            .unwrap();
            db.execute(
                "INSERT INTO session VALUES ('child',?1,'child',13,'main')",
                params![temp.0.to_string_lossy()],
            )
            .unwrap();
            db.execute(
                "INSERT INTO message VALUES ('m','main',1,?1)",
                params![
                    json!({"tokens":{"input":10,"output":5,"cache":{"read":2}},"cost":0.01})
                        .to_string()
                ],
            )
            .unwrap();
            db.execute(
                "INSERT INTO part VALUES ('m',1,?1)",
                params![json!({"type":"text","text":"answer"}).to_string()],
            )
            .unwrap();
        }
        let before = fs::read(&file).unwrap();
        let rows = opencode(
            &file,
            &Root {
                agent_id: "opencode".into(),
                path: file.to_string_lossy().into(),
                account_key: "{}".into(),
            },
            &temp.0,
            &AtomicBool::new(false),
        )
        .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].usage.cache_read, 2);
        assert!(rows[0].text.contains("answer"));
        assert_eq!(before, fs::read(&file).unwrap());
    }
    #[test]
    fn gemini_registry_jsonl_and_grok_companion_refresh() {
        let temp = Temp::new();
        let home = temp.0.join("gemini");
        let chats = home.join("tmp/project-one/chats");
        fs::create_dir_all(&chats).unwrap();
        fs::write(
            home.join("projects.json"),
            json!({"projects":{temp.0.to_string_lossy().to_string():"project-one"}}).to_string(),
        )
        .unwrap();
        fs::write(chats.join("session.jsonl"), format!("{}\n{}\n{}\n", json!({"sessionId":"gemini-one"}), json!({"type":"user","content":"hello"}), json!({"type":"gemini","content":"answer","tokens":{"input":10,"output":5,"cached":3}}))).unwrap();
        let grok = temp.0.join("grok/session-one");
        fs::create_dir_all(&grok).unwrap();
        fs::write(
            grok.join("session.json"),
            json!({"info":{"id":"grok-one","cwd":temp.0},"generated_title":"title"}).to_string(),
        )
        .unwrap();
        fs::write(grok.join("chat_history.jsonl"), "").unwrap();
        let mut req = request(
            &temp.0,
            vec![
                Root {
                    agent_id: "gemini".into(),
                    path: home.join("tmp").to_string_lossy().into(),
                    account_key: "{}".into(),
                },
                Root {
                    agent_id: "grok".into(),
                    path: temp.0.join("grok").to_string_lossy().into(),
                    account_key: "{}".into(),
                },
            ],
        );
        let cancel = AtomicBool::new(false);
        execute("scan", &req, &cancel).unwrap();
        let page = execute("query", &req, &cancel).unwrap();
        assert_eq!(page["total"], 2);
        assert_eq!(page["usage"]["input"], 10);
        assert_eq!(page["usage"]["partial"], true);
        fs::write(
            grok.join("chat_history.jsonl"),
            format!(
                "{}\n",
                json!({"type":"assistant","content":"new companion text"})
            ),
        )
        .unwrap();
        execute("scan", &req, &cancel).unwrap();
        req.query = "new companion".into();
        assert_eq!(execute("query", &req, &cancel).unwrap()["total"], 1);
    }
    #[test]
    fn metadata_filters_precede_pagination_and_cost_stays_unknown() {
        let temp = Temp::new();
        let mut req = request(&temp.0, vec![]);
        let cancel = AtomicBool::new(false);
        execute("scan", &req, &cancel).unwrap();
        let db = Connection::open(&req.index).unwrap();
        for n in 0..105 {
            let row = Session {
                key: n.to_string(),
                cwd: temp.0.to_string_lossy().into(),
                title: format!("session {n}"),
                modified_at_ms: n,
                usage: Usage {
                    input: 2,
                    known: true,
                    cost: if n == 0 { None } else { Some(0.01) },
                    ..Default::default()
                },
                ..Default::default()
            };
            save(&db, &row, "test").unwrap();
        }
        let page = execute("query", &req, &cancel).unwrap();
        assert_eq!(page["rows"].as_array().unwrap().len(), 100);
        assert!(page["usage"]["cost"].is_null());
        req.metadata.insert(
            "0".into(),
            json!({"title":"renamed","tags":["needle"],"favorite":true}),
        );
        req.filter = "favorite".into();
        req.query = "needle".into();
        let page = execute("query", &req, &cancel).unwrap();
        assert_eq!(page["total"], 1);
        assert_eq!(page["rows"][0]["key"], "0");
    }
    #[test]
    fn claude_streamed_usage_counts_latest_message_once_including_cache() {
        let mut session = Session::default();
        let mut seen = HashMap::new();
        for output in [2, 7, 7] {
            consume(
                &mut session,
                &json!({"message":{"id":"one","role":"assistant","content":"answer","usage":{"input_tokens":10,"cache_read_input_tokens":3,"output_tokens":output}}}),
                &mut seen,
            );
        }
        assert_eq!(session.usage.input, 13);
        assert_eq!(session.usage.output, 7);
        assert_eq!(session.usage.cache_read, 3);
        assert_eq!(session.text.matches("answer").count(), 1);
    }
}
