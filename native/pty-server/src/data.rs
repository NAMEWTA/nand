//! Native history requests (scan, query, read, cancel) run on worker threads; one scan writes at a time.

use crate::{agent_data, session::{control, Outbox}};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex},
    thread,
};

#[derive(Clone)]
pub struct History {
    out: Outbox,
    jobs: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    writer: Arc<Mutex<()>>,
}

impl History {
    pub fn new(out: Outbox) -> Self {
        Self { out, jobs: Arc::new(Mutex::new(HashMap::new())), writer: Arc::new(Mutex::new(())) }
    }

    pub fn handle(&self, operation: &str, request_id: String, payload: Value) {
        if operation == "cancel" {
            if let Some(flag) = self.jobs.lock().unwrap().get(&request_id) {
                flag.store(true, Ordering::Relaxed);
            }
            return;
        }
        if !matches!(operation, "scan" | "query" | "read") {
            control(&self.out, json!({ "type": "history-result", "rid": request_id, "error": format!("unknown history request {operation}") }));
            return;
        }
        let request: agent_data::Request = match serde_json::from_value(payload) {
            Ok(request) => request,
            Err(error) => {
                control(&self.out, json!({ "type": "history-result", "rid": request_id, "error": error.to_string() }));
                return;
            }
        };
        let cancel = Arc::new(AtomicBool::new(false));
        self.jobs.lock().unwrap().insert(request_id.clone(), cancel.clone());
        let operation = operation.to_string();
        let this = self.clone();
        thread::spawn(move || {
            // Reads use their own connections and see committed batches while a scan continues.
            let result = if operation == "scan" {
                let _writer = this.writer.lock().unwrap();
                agent_data::execute(&operation, &request, &cancel)
            } else {
                agent_data::execute(&operation, &request, &cancel)
            };
            this.jobs.lock().unwrap().remove(&request_id);
            let message = match result {
                Ok(data) => json!({ "type": "history-result", "rid": request_id, "data": data }),
                Err(error) => json!({ "type": "history-result", "rid": request_id, "error": error }),
            };
            control(&this.out, message);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frame;
    use std::{sync::mpsc, time::Duration};

    fn next(rx: &mpsc::Receiver<Vec<u8>>) -> Value {
        let bytes = rx.recv_timeout(Duration::from_secs(10)).unwrap();
        let frame = frame::read_frame(&mut &bytes[..]).unwrap().unwrap();
        serde_json::from_slice(&frame.body).unwrap()
    }

    #[test]
    fn malformed_and_unknown_requests_answer_with_errors() {
        let (tx, rx) = mpsc::channel();
        let history = History::new(tx);
        history.handle("query", "a".into(), json!({ "vault": 3 }));
        let reply = next(&rx);
        assert_eq!(reply["rid"], "a");
        assert!(reply["error"].is_string());
        history.handle("drop-table", "b".into(), json!({}));
        assert_eq!(next(&rx)["rid"], "b");
    }

    #[test]
    fn a_cancelled_scan_waiting_for_the_writer_reports_cancellation() {
        let (tx, rx) = mpsc::channel();
        let history = History::new(tx);
        let vault = std::env::temp_dir().join(format!("nand-history-glue-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&vault).unwrap();
        let vault = std::fs::canonicalize(&vault).unwrap();
        let held = history.writer.clone();
        let guard = held.lock().unwrap();
        let index = vault.join(".nand/terminal-agent/device/index.sqlite");
        history.handle("scan", "s".into(), json!({ "vault": vault, "index": index }));
        std::thread::sleep(Duration::from_millis(100));
        history.handle("cancel", "s".into(), Value::Null);
        drop(guard);
        let reply = next(&rx);
        assert_eq!(reply["rid"], "s");
        assert_eq!(reply["error"], "cancelled");
        let _ = std::fs::remove_dir_all(&vault);
    }
}
