use sqlx::Row;
use tauri::State;

use crate::models::{QueryHistoryEntry, new_id};
use crate::state::AppState;

const MAX_HISTORY: i64 = 200;

#[tauri::command]
pub async fn add_query_history(
    state: State<'_, AppState>,
    sql: String,
    connection_id: Option<String>,
) -> Result<(), String> {
    let id = new_id();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO query_history (id, sql, connection_id, executed_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&sql)
    .bind(&connection_id)
    .bind(&now)
    .execute(&state.storage)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM query_history WHERE id NOT IN (SELECT id FROM query_history ORDER BY executed_at DESC LIMIT ?)")
        .bind(MAX_HISTORY)
        .execute(&state.storage)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn list_query_history(
    state: State<'_, AppState>,
) -> Result<Vec<QueryHistoryEntry>, String> {
    let rows = sqlx::query(
        "SELECT id, sql, connection_id, executed_at FROM query_history ORDER BY executed_at DESC LIMIT 100",
    )
    .fetch_all(&state.storage)
    .await
    .map_err(|e| e.to_string())?;

    let entries: Vec<QueryHistoryEntry> = rows
        .iter()
        .map(|row| QueryHistoryEntry {
            id: row.get("id"),
            sql: row.get("sql"),
            connection_id: row.get("connection_id"),
            executed_at: row.get("executed_at"),
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
pub async fn clear_query_history(
    state: State<'_, AppState>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM query_history")
        .execute(&state.storage)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
