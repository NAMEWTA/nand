//! Native history stays read-only. Expensive parsing runs on worker threads, outside the PTY readers.
//! Formats checked against stablyai/orca 27b823f (MIT, Lovecast Inc.).
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
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
    #[serde(default)]
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
pub(crate) struct Request {
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
pub(crate) fn execute(operation: &str, request: &Request, cancel: &AtomicBool) -> Result<Value, String> {
    check_cancel(cancel)?;
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
    secure_private_path(parent, &index)?;
    let mut db = open_index(&index, operation == "scan", cancel)?;
    // WAL sidecars appear only after open. A chmod miss does not delete the index.
    tighten_private_modes(parent, &index);
    if operation == "scan" {
        let mut warnings = Vec::new();
        let mut pending = Vec::new();
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
                            pending.push((row, "sqlite".to_owned()));
                            flush_if_ready(&mut db, &mut pending, cancel)?;
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
                        "SELECT EXISTS(SELECT 1 FROM history WHERE source=?1 AND stamp=?2 AND json_extract(summary,'$.accountKey')=?3 AND json_extract(summary,'$.agentId')=?4)",
                        params![source, stamp, root.account_key, root.agent_id],
                        |r| r.get(0),
                    )
                    .unwrap_or(false);
                if cached {
                    continue;
                }
                match parse(&path, root, &vault, modified, cancel) {
                    Ok(Some(session)) => {
                        pending.push((session, stamp));
                        flush_if_ready(&mut db, &mut pending, cancel)?;
                    }
                    Ok(None) => {}
                    Err(error) => warnings.push(format!("{}: {}", source, error)),
                }
            }
        }
        flush(&mut db, &mut pending, cancel)?;
        return Ok(json!({"warnings": warnings, "revision": revision(&db)?}));
    }
    if operation == "read" {
        let (raw, text): (String, String) = db
            .query_row(
                "SELECT h.summary,t.text FROM history h JOIN history_text t ON t.key=h.key WHERE h.key=?1",
                params![request.key],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|e| e.to_string())?;
        let mut session: Session = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        session.text = text;
        if !inside(&vault, &session.cwd) {
            return Err("session outside vault".into());
        }
        return Ok(json!(session));
    }
    if operation != "query" {
        return Err("unknown history operation".into());
    }
    query(&mut db, request, &vault, cancel)
}

/// History is private vault metadata. Tighten only NAND-owned paths and never
/// follow a symlink while doing so.
fn secure_private_path(parent: &Path, index: &Path) -> Result<(), String> {
    let mut current = PathBuf::new();
    let mut private = false;
    for component in parent.components() {
        current.push(component);
        if component.as_os_str() == ".nand" { private = true; }
        let metadata = fs::symlink_metadata(&current).map_err(|e| e.to_string())?;
        if metadata.file_type().is_symlink() { return Err("symlinked history directory".into()); }
        #[cfg(unix)] if private {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&current, fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;
        }
    }
    if index.exists() {
        if fs::symlink_metadata(index).map_err(|e| e.to_string())?.file_type().is_symlink() { return Err("symlinked index".into()); }
        #[cfg(unix)] {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(index, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
            for suffix in ["-wal", "-shm"] {
                let sidecar = PathBuf::from(format!("{}{}", index.display(), suffix));
                if sidecar.exists() { fs::set_permissions(sidecar, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?; }
            }
        }
    }
    Ok(())
}

/// Tighten modes after SQLite has created the index and its sidecars.
/// Symlinks are skipped. A permission error is ignored and nothing is deleted.
fn tighten_private_modes(parent: &Path, index: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = |path: &Path, bits: u32| {
            if fs::symlink_metadata(path).ok().is_some_and(|meta| meta.file_type().is_symlink()) {
                return;
            }
            let _ = fs::set_permissions(path, fs::Permissions::from_mode(bits));
        };
        mode(parent, 0o700);
        mode(index, 0o600);
        for suffix in ["-wal", "-shm"] {
            let sidecar = PathBuf::from(format!("{}{}", index.display(), suffix));
            if sidecar.exists() {
                mode(&sidecar, 0o600);
            }
        }
    }
    #[cfg(not(unix))]
    {
        let _ = (parent, index);
    }
}
fn save(db: &Connection, row: &Session, stamp: &str) -> rusqlite::Result<usize> {
    let mut summary = serde_json::to_value(row).unwrap();
    summary.as_object_mut().unwrap().remove("text");
    db.execute(
        "INSERT OR REPLACE INTO history_text(key,text) VALUES (?1,?2)",
        params![row.key, row.text],
    )?;
    db.execute(
        "INSERT OR REPLACE INTO history VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
        params![
            row.key,
            row.transcript_path,
            stamp,
            summary.to_string(),
            format!("{}\n{}\n{}", row.title, row.cwd, row.text).to_lowercase(),
            row.modified_at_ms,
            row.cwd,
            row.usage.input,
            row.usage.output,
            row.usage.cache_read,
            row.usage.cache_write,
            row.usage.cost,
            row.usage.known,
            row.usage.partial
        ],
    )
}
fn check_cancel(cancel: &AtomicBool) -> Result<(), String> {
    if cancel.load(Ordering::Relaxed) {
        Err("cancelled".into())
    } else {
        Ok(())
    }
}
const SCHEMA: i64 = 1;
fn open_index(index: &Path, writer: bool, cancel: &AtomicBool) -> Result<Connection, String> {
    check_cancel(cancel)?;
    if index.exists() {
        let db = Connection::open_with_flags(
            index,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(|e| e.to_string())?;
        db.busy_timeout(Duration::from_secs(2))
            .map_err(|e| e.to_string())?;
        let version: i64 = db
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if version > SCHEMA {
            return Err("history index version is newer than this server".into());
        }
        if version == SCHEMA && !writer {
            return Ok(db);
        }
    }
    let mut db = Connection::open(index).map_err(|e| e.to_string())?;
    db.busy_timeout(Duration::from_secs(2))
        .map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
        .map_err(|e| e.to_string())?;
    init_schema(&mut db, cancel)?;
    if writer {
        Ok(db)
    } else {
        drop(db);
        open_index(index, false, cancel)
    }
}
/// Create the history schema in an empty index; an index of another version is refused.
fn init_schema(db: &mut Connection, cancel: &AtomicBool) -> Result<(), String> {
    check_cancel(cancel)?;
    let tx = db
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let version: i64 = tx
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if version == SCHEMA {
        return Ok(());
    }
    if version > SCHEMA {
        return Err("history index version is newer than this server".into());
    }
    tx.execute_batch("CREATE TABLE history(key TEXT PRIMARY KEY,source TEXT NOT NULL,stamp TEXT NOT NULL,summary TEXT NOT NULL,body TEXT NOT NULL,modified INTEGER NOT NULL,cwd TEXT NOT NULL,input INTEGER NOT NULL,output INTEGER NOT NULL,cache_read INTEGER NOT NULL,cache_write INTEGER NOT NULL,cost REAL,known INTEGER NOT NULL,partial INTEGER NOT NULL);
        CREATE TABLE history_text(key TEXT PRIMARY KEY,text TEXT NOT NULL);
        CREATE TABLE history_revision(revision INTEGER NOT NULL); INSERT INTO history_revision VALUES (0);
        CREATE INDEX history_source_stamp ON history(source,stamp); CREATE INDEX history_modified ON history(modified DESC,key ASC); CREATE INDEX history_cwd ON history(cwd);").map_err(|e| e.to_string())?;
    tx.execute_batch(&format!("PRAGMA user_version={SCHEMA};"))
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
fn revision(db: &Connection) -> Result<u64, String> {
    db.query_row("SELECT revision FROM history_revision", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}
fn flush_if_ready(
    db: &mut Connection,
    pending: &mut Vec<(Session, String)>,
    cancel: &AtomicBool,
) -> Result<(), String> {
    if pending.len() >= 32 {
        flush(db, pending, cancel)?;
    }
    Ok(())
}
fn flush(
    db: &mut Connection,
    pending: &mut Vec<(Session, String)>,
    cancel: &AtomicBool,
) -> Result<(), String> {
    check_cancel(cancel)?;
    if pending.is_empty() {
        return Ok(());
    }
    let tx = db.transaction().map_err(|e| e.to_string())?;
    for (row, stamp) in pending.iter() {
        check_cancel(cancel)?;
        save(&tx, row, stamp).map_err(|e| e.to_string())?;
    }
    tx.execute("UPDATE history_revision SET revision=revision+1", [])
        .map_err(|e| e.to_string())?;
    check_cancel(cancel)?;
    tx.commit().map_err(|e| e.to_string())?;
    pending.clear();
    Ok(())
}
fn query(
    db: &mut Connection,
    request: &Request,
    vault: &Path,
    cancel: &AtomicBool,
) -> Result<Value, String> {
    check_cancel(cancel)?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    // Revalidate each distinct directory, rather than each transcript. This
    // keeps symlink/moved-directory scope enforcement without N filesystem IOs.
    let mut allowed = Vec::new();
    {
        let mut stmt = tx
            .prepare("SELECT DISTINCT cwd FROM history")
            .map_err(|e| e.to_string())?;
        for cwd in stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?
        {
            check_cancel(cancel)?;
            let cwd = cwd.map_err(|e| e.to_string())?;
            if inside(vault, &cwd) {
                allowed.push(cwd);
            }
        }
    }
    let pattern = request.query.to_lowercase();
    let mut matching = Vec::new();
    let mut archived = Vec::new();
    let mut favorites = Vec::new();
    for (key, meta) in &request.metadata {
        if meta.to_string().to_lowercase().contains(&pattern) {
            matching.push(key);
        }
        if meta["archived"].as_bool() == Some(true) {
            archived.push(key);
        }
        if meta["favorite"].as_bool() == Some(true) {
            favorites.push(key);
        }
    }
    let matching = serde_json::to_string(&matching).unwrap();
    let allowed = serde_json::to_string(&allowed).unwrap();
    let archived = serde_json::to_string(&archived).unwrap();
    let favorites = serde_json::to_string(&favorites).unwrap();
    let predicate = "FROM history WHERE cwd IN (SELECT value FROM json_each(?3)) AND (?1='' OR instr(body,?1)>0 OR key IN (SELECT value FROM json_each(?2))) AND (CASE ?4 WHEN 'active' THEN key NOT IN (SELECT value FROM json_each(?5)) WHEN 'archived' THEN key IN (SELECT value FROM json_each(?5)) WHEN 'favorite' THEN key IN (SELECT value FROM json_each(?6)) ELSE 1 END)";
    let bind = params![
        pattern,
        matching,
        allowed,
        request.filter,
        archived,
        favorites
    ];
    let (total, usage): (u64, Usage) = tx.query_row(&format!("SELECT COUNT(*),COALESCE(SUM(input),0),COALESCE(SUM(output),0),COALESCE(SUM(cache_read),0),COALESCE(SUM(cache_write),0),CASE WHEN COUNT(cost)=COUNT(*) THEN SUM(cost) ELSE NULL END,COALESCE(MAX(known),0),COALESCE(MAX(partial OR NOT known),0) {predicate}"), bind, |r| Ok((r.get(0)?, Usage { input:r.get(1)?, output:r.get(2)?, cache_read:r.get(3)?, cache_write:r.get(4)?, cost:r.get(5)?, known:r.get(6)?, partial:r.get(7)? }))).map_err(|e| e.to_string())?;
    check_cancel(cancel)?;
    let mut stmt = tx
        .prepare(&format!(
            "SELECT summary {predicate} ORDER BY modified DESC,key ASC LIMIT 100 OFFSET ?7"
        ))
        .map_err(|e| e.to_string())?;
    let mut page = Vec::new();
    for raw in stmt
        .query_map(
            params![
                pattern,
                matching,
                allowed,
                request.filter,
                archived,
                favorites,
                request.offset
            ],
            |r| r.get::<_, String>(0),
        )
        .map_err(|e| e.to_string())?
    {
        check_cancel(cancel)?;
        page.push(
            serde_json::from_str::<Value>(&raw.map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?,
        );
    }
    Ok(json!({"rows":page,"total":total,"usage":usage,"revision":revision(&tx)?}))
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
        assert_eq!(
            execute("query", &req, &cancel).unwrap_err(),
            "index outside vault"
        );
        assert!(!Path::new(&req.index).exists());
        req.index = Path::new(&req.vault)
            .join(".nand/../../escape.sqlite")
            .to_string_lossy()
            .into();
        assert_eq!(
            execute("query", &req, &cancel).unwrap_err(),
            "index outside vault"
        );
        #[cfg(unix)]
        {
            let linked = temp.0.join(".nand/escape");
            std::os::unix::fs::symlink(&outside.0, &linked).unwrap();
            req.index = linked.join("linked.sqlite").to_string_lossy().into();
            req.vault = temp.0.to_string_lossy().into();
            assert_eq!(
                execute("query", &req, &cancel).unwrap_err(),
                "index outside vault"
            );
            assert!(!outside.0.join("linked.sqlite").exists());
            let source = outside.0.join("source.sqlite");
            fs::write(&source, b"preserve native file").unwrap();
            let linked = temp.0.join(".nand/linked.sqlite");
            std::os::unix::fs::symlink(&source, &linked).unwrap();
            req.index = linked.to_string_lossy().into();
            assert_eq!(
                execute("query", &req, &cancel).unwrap_err(),
                "symlinked index"
            );
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
    #[cfg(unix)]
    #[test]
    fn history_index_is_0700_and_0600_and_a_sidecar_symlink_is_not_followed() {
        use std::os::unix::fs::PermissionsExt;
        let temp = Temp::new();
        let cancel = AtomicBool::new(false);
        let req = request(&temp.0, vec![]);
        execute("scan", &req, &cancel).expect("scan");
        let index = PathBuf::from(&req.index);
        let parent = index.parent().unwrap().to_path_buf();
        let nand = temp.0.join(".nand");
        let mode = |path: &Path| fs::symlink_metadata(path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&nand), 0o700);
        assert_eq!(mode(&parent), 0o700);
        assert_eq!(mode(&index), 0o600);
        let wal = PathBuf::from(format!("{}-wal", index.display()));
        let shm = PathBuf::from(format!("{}-shm", index.display()));
        fs::write(&wal, b"wal").unwrap();
        fs::write(&shm, b"shm").unwrap();
        fs::set_permissions(&wal, fs::Permissions::from_mode(0o644)).unwrap();
        fs::set_permissions(&shm, fs::Permissions::from_mode(0o644)).unwrap();
        tighten_private_modes(&parent, &index);
        assert_eq!(mode(&wal), 0o600);
        assert_eq!(mode(&shm), 0o600);
        let outside = Temp::new();
        let secret = outside.0.join("secret");
        fs::write(&secret, b"keep").unwrap();
        let before = mode(&secret);
        fs::remove_file(&shm).unwrap();
        std::os::unix::fs::symlink(&secret, &shm).unwrap();
        tighten_private_modes(&parent, &index);
        assert!(fs::symlink_metadata(&shm).unwrap().file_type().is_symlink());
        assert_eq!(fs::read(&secret).unwrap(), b"keep");
        assert_eq!(mode(&secret), before);
        println!("posix dir={:03o} file={:03o} wal={:03o}", mode(&nand), mode(&index), mode(&wal));
    }
    #[test]
    fn new_index_gets_the_current_schema_and_a_newer_index_is_refused() {
        let temp = Temp::new();
        let path = temp.0.join("index.sqlite");
        let cancel = AtomicBool::new(false);
        let db = open_index(&path, true, &cancel).unwrap();
        assert_eq!(
            db.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            SCHEMA
        );
        assert!(db.prepare("SELECT key,text FROM history_text").is_ok());
        assert_eq!(revision(&db).unwrap(), 0);
        drop(db);
        open_index(&path, true, &cancel).unwrap(); // Idempotent reopen.
        let db = Connection::open(&path).unwrap();
        db.execute_batch(&format!("PRAGMA user_version={};", SCHEMA + 1))
            .unwrap();
        drop(db);
        assert!(open_index(&path, false, &cancel)
            .unwrap_err()
            .contains("newer"));
    }
    #[test]
    fn sql_paging_aggregates_and_literal_substrings_do_not_load_transcript_rows() {
        let temp = Temp::new();
        let mut req = request(&temp.0, vec![]);
        let cancel = AtomicBool::new(false);
        execute("scan", &req, &cancel).unwrap();
        let db = Connection::open(&req.index).unwrap();
        for n in 0..205 {
            let row = Session {
                key: format!("key-{n}"),
                cwd: temp.0.to_string_lossy().into(),
                title: format!("title-{n}"),
                modified_at_ms: n,
                text: format!("MiXeD %_ fragment 中文{}", "x".repeat(10240)),
                usage: Usage {
                    input: 2,
                    output: 3,
                    known: n != 0,
                    partial: n == 1,
                    cost: if n == 0 { None } else { Some(0.5) },
                    ..Default::default()
                },
                ..Default::default()
            };
            save(&db, &row, "test").unwrap();
        }
        // Query correctness must not depend on a full transcript being readable.
        db.execute("DELETE FROM history_text", []).unwrap();
        req.query = "mixed %_ fragment 中文".into();
        req.offset = 100;
        let page = execute("query", &req, &cancel).unwrap();
        assert_eq!(page["total"], 205);
        assert_eq!(page["rows"].as_array().unwrap().len(), 100);
        assert_eq!(page["rows"][0]["key"], "key-104");
        assert!(page["rows"][0].get("text").is_none());
        assert_eq!(page["usage"]["input"], 410);
        assert_eq!(page["usage"]["output"], 615);
        assert_eq!(page["usage"]["partial"], true);
        assert!(page["usage"]["cost"].is_null());
        req.metadata.insert(
            "key-0".into(),
            json!({"title":"renamedneedle","favorite":true}),
        );
        req.query = "namedneed".into();
        req.offset = 0;
        req.filter = "favorite".into();
        let page = execute("query", &req, &cancel).unwrap();
        assert_eq!(page["total"], 1);
        assert_eq!(page["rows"][0]["key"], "key-0");
    }
    #[test]
    fn independent_wal_reader_sees_only_committed_batches_without_waiting_for_writer() {
        let temp = Temp::new();
        let req = request(&temp.0, vec![]);
        let cancel = AtomicBool::new(false);
        execute("scan", &req, &cancel).unwrap();
        let mut writer = open_index(Path::new(&req.index), true, &cancel).unwrap();
        let row = Session {
            key: "committed".into(),
            cwd: temp.0.to_string_lossy().into(),
            ..Default::default()
        };
        flush(&mut writer, &mut vec![(row.clone(), "one".into())], &cancel).unwrap();
        let tx = writer
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .unwrap();
        save(
            &tx,
            &Session {
                key: "pending".into(),
                ..row
            },
            "two",
        )
        .unwrap();
        assert_eq!(execute("query", &req, &cancel).unwrap()["total"], 1);
        tx.commit().unwrap();
        assert_eq!(execute("query", &req, &cancel).unwrap()["total"], 2);
        assert_eq!(
            execute("query", &req, &AtomicBool::new(true)).unwrap_err(),
            "cancelled"
        );
    }
}
