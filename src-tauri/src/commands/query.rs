use sqlx::Row;
use tauri::State;

use crate::models::{SavedQuery, new_id};
use crate::state::AppState;

#[tauri::command]
pub async fn save_query(
    state: State<'_, AppState>,
    name: String,
    sql: String,
    connection_id: Option<String>,
    color: Option<String>,
) -> Result<SavedQuery, String> {
    let id = new_id();
    let now = chrono::Utc::now().to_rfc3339();
    let query = SavedQuery {
        id,
        name,
        sql,
        connection_id,
        color,
        updated_at: now,
    };

    sqlx::query(
        "INSERT INTO saved_queries (id, name, sql, connection_id, color, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&query.id)
    .bind(&query.name)
    .bind(&query.sql)
    .bind(&query.connection_id)
    .bind(&query.color)
    .bind(&query.updated_at)
    .execute(&state.storage)
    .await
    .map_err(|e| e.to_string())?;

    Ok(query)
}

#[tauri::command]
pub async fn update_query(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    sql: Option<String>,
    connection_id: Option<Option<String>>,
    color: Option<Option<String>>,
) -> Result<SavedQuery, String> {
    let row = sqlx::query(
        "SELECT id, name, sql, connection_id, color, updated_at FROM saved_queries WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.storage)
    .await
    .map_err(|e| e.to_string())?;

    let current_name: String = row.get("name");
    let current_sql: String = row.get("sql");
    let current_connection_id: Option<String> = row.get("connection_id");
    let current_color: Option<String> = row.get("color");

    let final_name = name.unwrap_or(current_name);
    let final_sql = sql.unwrap_or(current_sql);
    let final_connection_id = connection_id.unwrap_or(current_connection_id);
    let final_color = color.unwrap_or(current_color);
    let updated_at = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE saved_queries SET name = ?, sql = ?, connection_id = ?, color = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&final_name)
    .bind(&final_sql)
    .bind(&final_connection_id)
    .bind(&final_color)
    .bind(&updated_at)
    .bind(&id)
    .execute(&state.storage)
    .await
    .map_err(|e| e.to_string())?;

    Ok(SavedQuery {
        id,
        name: final_name,
        sql: final_sql,
        connection_id: final_connection_id,
        color: final_color,
        updated_at,
    })
}

#[tauri::command]
pub async fn list_saved_queries(
    state: State<'_, AppState>,
) -> Result<Vec<SavedQuery>, String> {
    let rows = sqlx::query(
        "SELECT id, name, sql, connection_id, color, updated_at FROM saved_queries ORDER BY updated_at DESC",
    )
    .fetch_all(&state.storage)
    .await
    .map_err(|e| e.to_string())?;

    let queries: Vec<SavedQuery> = rows
        .iter()
        .map(|row| SavedQuery {
            id: row.get("id"),
            name: row.get("name"),
            sql: row.get("sql"),
            connection_id: row.get("connection_id"),
            color: row.get("color"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    Ok(queries)
}

#[tauri::command]
pub async fn delete_query(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM saved_queries WHERE id = ?")
        .bind(&id)
        .execute(&state.storage)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
