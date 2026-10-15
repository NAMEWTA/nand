//! Read a caller-owned cookie database snapshot. The source is never opened writable.
use crate::session::{control, Outbox};
use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};
use std::{path::Path, thread};

pub fn handle(out: Outbox, op: String, rid: String, payload: Value) {
    thread::spawn(move || {
        let result = if op == "read" {
            read(&payload)
        } else {
            Err("Unknown cookie operation".to_string())
        };
        match result {
            Ok(data) => control(&out, json!({"type":"cookies-result", "rid":rid, "data":data})),
            Err(error) => control(&out, json!({"type":"cookies-result", "rid":rid, "error":error})),
        }
    });
}
fn read(payload: &Value) -> Result<Value, String> {
    let path = payload["path"].as_str().ok_or("Missing cookie snapshot path")?;
    if !Path::new(path).is_absolute() { return Err("Cookie snapshot path must be absolute".into()); }
    let db = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
    db.busy_timeout(std::time::Duration::from_secs(3)).map_err(|e| e.to_string())?;
    let firefox = match payload["kind"].as_str() {
        Some("firefox") => true, Some("chromium") => false, _ => return Err("Unknown cookie database kind".into()),
    };
    let sql = if firefox {
        "SELECT host, name, value, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies LIMIT 50001"
    } else {
        "SELECT host_key, name, value, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite FROM cookies LIMIT 50001"
    };
    let mut statement = db.prepare(sql).map_err(|e| e.to_string())?;
    let rows = statement.query_map([], |r| {
        if firefox {
            Ok(json!({"host_key":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"value":r.get::<_,String>(2)?,"path":r.get::<_,String>(3)?,"expiry":r.get::<_,i64>(4)?.to_string(),"is_secure":r.get::<_,i64>(5)?,"is_httponly":r.get::<_,i64>(6)?,"samesite":r.get::<_,i64>(7)?}))
        } else {
            let bytes: Vec<u8> = r.get(3)?;
            Ok(json!({"host_key":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"value":r.get::<_,String>(2)?,"encrypted_value_hex":bytes.iter().map(|b| format!("{b:02x}")).collect::<String>(),"path":r.get::<_,String>(4)?,"expires_utc":r.get::<_,i64>(5)?.to_string(),"is_secure":r.get::<_,i64>(6)?,"is_httponly":r.get::<_,i64>(7)?,"samesite":r.get::<_,i64>(8)?}))
        }
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e| e.to_string())?;
    if rows.len() > 50000 { return Err("Cookie database exceeds 50000 rows".into()); }
    Ok(json!({"rows":rows}))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_encrypted_bytes_and_large_timestamps() {
        let path=std::env::temp_dir().join(format!("nand-cookies-{}.sqlite",std::process::id()));
        let _=std::fs::remove_file(&path);
        let db=Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE cookies(host_key TEXT,name TEXT,value TEXT,encrypted_value BLOB,path TEXT,expires_utc INTEGER,is_secure INTEGER,is_httponly INTEGER,samesite INTEGER); INSERT INTO cookies VALUES('.example.com','sid','',X'763130FF','/',13390000000000001,1,1,1); CREATE TABLE moz_cookies(host TEXT,name TEXT,value TEXT,path TEXT,expiry INTEGER,isSecure INTEGER,isHttpOnly INTEGER,sameSite INTEGER); INSERT INTO moz_cookies VALUES('.example.org','session','ok','/',1800000000,1,1,2);").unwrap();
        drop(db);
        let data=read(&json!({"path":path,"kind":"chromium"})).unwrap();
        assert_eq!(data["rows"][0]["expires_utc"],"13390000000000001");
        assert_eq!(data["rows"][0]["encrypted_value_hex"],"763130ff");
        assert_eq!(read(&json!({"path":path,"kind":"firefox"})).unwrap()["rows"][0]["value"],"ok");
        assert!(read(&json!({"path":path,"kind":"unknown"})).is_err());
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn missing_database_is_not_created() {
        let path=std::env::temp_dir().join("nand-cookie-missing-test.sqlite");
        assert!(read(&json!({"path":path,"kind":"chromium"})).is_err());
        assert!(!path.exists());
    }
}
