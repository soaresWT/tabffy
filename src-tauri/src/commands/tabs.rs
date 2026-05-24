use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;

use crate::state::AppState;

#[derive(Serialize, Deserialize)]
pub struct SavedTab {
    pub tab_id: String,
    pub name: String,
    pub sql: String,
    pub connection_id: Option<String>,
    pub saved_query_id: Option<String>,
    pub position: i32,
    pub is_active: bool,
}

#[tauri::command]
pub async fn save_open_tabs(
    state: State<'_, AppState>,
    tabs: Vec<SavedTab>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM open_tabs")
        .execute(&state.storage)
        .await
        .map_err(|e| e.to_string())?;

    for tab in tabs {
        sqlx::query(
            "INSERT INTO open_tabs (tab_id, name, sql, connection_id, saved_query_id, position, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&tab.tab_id)
        .bind(&tab.name)
        .bind(&tab.sql)
        .bind(&tab.connection_id)
        .bind(&tab.saved_query_id)
        .bind(tab.position)
        .bind(tab.is_active as i32)
        .execute(&state.storage)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn load_open_tabs(
    state: State<'_, AppState>,
) -> Result<Vec<SavedTab>, String> {
    let rows =
        sqlx::query("SELECT tab_id, name, sql, connection_id, saved_query_id, position, is_active FROM open_tabs ORDER BY position")
            .fetch_all(&state.storage)
            .await
            .map_err(|e| e.to_string())?;

    let tabs: Vec<SavedTab> = rows
        .iter()
        .map(|row| {
            let is_active: i32 = row.get("is_active");
            SavedTab {
                tab_id: row.get("tab_id"),
                name: row.get("name"),
                sql: row.get("sql"),
                connection_id: row.get("connection_id"),
                saved_query_id: row.get("saved_query_id"),
                position: row.get("position"),
                is_active: is_active != 0,
            }
        })
        .collect();

    Ok(tabs)
}
