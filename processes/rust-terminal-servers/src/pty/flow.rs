use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use tokio::sync::Notify;

pub const OUTPUT_WINDOW: usize = 256 * 1024;
pub const OUTPUT_BATCH: usize = 64 * 1024;
const OUTPUT_LOW: usize = 64 * 1024;

/** Raw-byte credits with 256 KiB/64 KiB hysteresis. Only one output pump reserves. */
pub struct OutputCredits {
    outstanding: AtomicUsize,
    paused: AtomicBool,
    closed: AtomicBool,
    changed: Notify,
}
impl OutputCredits {
    pub fn new() -> Self { Self { outstanding: AtomicUsize::new(0), paused: AtomicBool::new(false), closed: AtomicBool::new(false), changed: Notify::new() } }
    pub async fn reserve(&self, bytes: usize) -> bool {
        if bytes > OUTPUT_WINDOW { return false; }
        loop {
            if self.closed.load(Ordering::Acquire) { return false; }
            let count = self.outstanding.load(Ordering::Acquire);
            if self.paused.load(Ordering::Acquire) && count > OUTPUT_LOW {
                self.changed.notified().await;
                continue;
            }
            if count + bytes > OUTPUT_WINDOW {
                self.paused.store(true, Ordering::Release);
                continue;
            }
            if self.outstanding.compare_exchange(count, count + bytes, Ordering::AcqRel, Ordering::Acquire).is_ok() {
                self.paused.store(false, Ordering::Release);
                return true;
            }
        }
    }
    pub fn consumed(&self, bytes: usize) -> Result<(), &'static str> {
        if bytes == 0 { return Err("Invalid output acknowledgement"); }
        let previous = self.outstanding.fetch_update(Ordering::AcqRel, Ordering::Acquire, |count| count.checked_sub(bytes))
            .map_err(|_| "Invalid output acknowledgement")?;
        if previous - bytes <= OUTPUT_LOW { self.changed.notify_one(); }
        Ok(())
    }
    pub fn close(&self) { self.closed.store(true, Ordering::Release); self.changed.notify_one(); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn credits_bound_output_and_close_unblocks_waiters() {
        let credits = OutputCredits::new();
        assert!(credits.reserve(OUTPUT_WINDOW).await);
        assert!(tokio::time::timeout(std::time::Duration::from_millis(10), credits.reserve(1)).await.is_err());
        credits.consumed(OUTPUT_BATCH).unwrap();
        assert!(tokio::time::timeout(std::time::Duration::from_millis(10), credits.reserve(1)).await.is_err());
        credits.consumed(2 * OUTPUT_BATCH).unwrap();
        assert!(credits.reserve(OUTPUT_BATCH).await);
        assert!(credits.consumed(OUTPUT_WINDOW + 1).is_err());
        credits.close();
        assert!(!credits.reserve(1).await);
    }
}
