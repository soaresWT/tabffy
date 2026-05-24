use std::collections::HashMap;
use std::sync::Arc;
use sqlx::SqlitePool;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::db::Driver;

pub struct AppState {
    pub active_drivers: Arc<Mutex<HashMap<String, Driver>>>,
    pub storage: SqlitePool,
    pub cancellation_tokens: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl AppState {
    pub fn new(storage: SqlitePool) -> Self {
        Self {
            active_drivers: Arc::new(Mutex::new(HashMap::new())),
            storage,
            cancellation_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
