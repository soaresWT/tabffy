use serde::Deserialize;
use sqlx::Row;
use tauri::State;
use tokio_util::sync::CancellationToken;

use crate::db::{Driver, DriverError};
use crate::models::{Connection, ConnectionType, QueryResult, SchemaInfo, TableInfo, ColumnInfo};
use crate::state::AppState;

#[derive(Deserialize)]
#[serde(tag = "type", content = "url")]
pub enum TestConnectionParams {
    #[serde(rename = "postgres")]
    Postgres(String),
    #[serde(rename = "sqlite")]
    Sqlite(String),
}

impl TestConnectionParams {
    fn connection_type(&self) -> ConnectionType {
        match self {
            Self::Postgres(_) => ConnectionType::Postgres,
            Self::Sqlite(_) => ConnectionType::Sqlite,
        }
    }

    fn url(&self) -> &str {
        match self {
            Self::Postgres(u) | Self::Sqlite(u) => u,
        }
    }
}

#[tauri::command]
pub async fn test_connection(params: TestConnectionParams) -> Result<(), String> {
    let driver = Driver::connect(&params.connection_type(), params.url())
        .await
        .map_err(|e| e.to_string())?;
    driver.test().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Deserialize)]
pub struct SaveConnectionParams {
    pub name: String,
    pub url: String,
    pub connection_type: ConnectionType,
}

#[tauri::command]
pub async fn save_connection(
    state: State<'_, AppState>,
    params: SaveConnectionParams,
) -> Result<Connection, String> {
    let id = crate::models::new_id();
    let conn = Connection {
        id,
        name: params.name,
        connection_type: params.connection_type,
        url: params.url,
    };
    let type_str = match conn.connection_type {
        ConnectionType::Postgres => "postgres",
        ConnectionType::Sqlite => "sqlite",
    };
    sqlx::query(
        "INSERT INTO connections (id, name, connection_type, url) VALUES (?, ?, ?, ?)",
    )
    .bind(&conn.id)
    .bind(&conn.name)
    .bind(type_str)
    .bind(&conn.url)
    .execute(&state.storage)
    .await
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

#[tauri::command]
pub async fn list_connections(
    state: State<'_, AppState>,
) -> Result<Vec<Connection>, String> {
    let rows = sqlx::query("SELECT id, name, connection_type, url FROM connections")
        .fetch_all(&state.storage)
        .await
        .map_err(|e| e.to_string())?;

    let connections: Vec<Connection> = rows
        .iter()
        .map(|row| {
            let type_str: &str = row.get("connection_type");
            Connection {
                id: row.get("id"),
                name: row.get("name"),
                connection_type: match type_str {
                    "postgres" => ConnectionType::Postgres,
                    _ => ConnectionType::Sqlite,
                },
                url: row.get("url"),
            }
        })
        .collect();

    Ok(connections)
}

#[tauri::command]
pub async fn delete_connection(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM connections WHERE id = ?")
        .bind(&id)
        .execute(&state.storage)
        .await
        .map_err(|e| e.to_string())?;
    state.active_drivers.lock().await.remove(&id);
    Ok(())
}

#[tauri::command]
pub async fn update_connection(
    state: State<'_, AppState>,
    id: String,
    name: String,
    url: String,
    connection_type: ConnectionType,
) -> Result<Connection, String> {
    let type_str = match connection_type {
        ConnectionType::Postgres => "postgres",
        ConnectionType::Sqlite => "sqlite",
    };
    sqlx::query(
        "UPDATE connections SET name = ?, url = ?, connection_type = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&url)
    .bind(type_str)
    .bind(&id)
    .execute(&state.storage)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(driver) = state.active_drivers.lock().await.remove(&id) {
        drop(driver);
    }

    Ok(Connection {
        id,
        name,
        connection_type,
        url,
    })
}

#[tauri::command]
pub async fn activate_connection(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let row =
        sqlx::query("SELECT id, name, connection_type, url FROM connections WHERE id = ?")
            .bind(&id)
            .fetch_one(&state.storage)
            .await
            .map_err(|e| e.to_string())?;

    let type_str: &str = row.get("connection_type");
    let url: String = row.get("url");
    let connection_type = match type_str {
        "postgres" => ConnectionType::Postgres,
        _ => ConnectionType::Sqlite,
    };

    let driver = Driver::connect(&connection_type, &url)
        .await
        .map_err(|e| e.to_string())?;
    state.active_drivers.lock().await.insert(id, driver);
    Ok(())
}

#[tauri::command]
pub async fn deactivate_connection(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.active_drivers.lock().await.remove(&id);
    Ok(())
}

#[tauri::command]
pub async fn is_connection_active(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let drivers = state.active_drivers.lock().await;
    Ok(drivers.contains_key(&id))
}

#[tauri::command]
pub async fn list_schemas(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<Vec<SchemaInfo>, String> {
    let drivers = state.active_drivers.lock().await;
    let driver = drivers.get(&connection_id).ok_or("Connection not active")?;
    driver.list_schemas().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_tables(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
) -> Result<Vec<TableInfo>, String> {
    let drivers = state.active_drivers.lock().await;
    let driver = drivers.get(&connection_id).ok_or("Connection not active")?;
    driver
        .list_tables(&schema)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_query(
    state: State<'_, AppState>,
    connection_id: String,
    sql: String,
    limit: Option<u32>,
    offset: Option<u32>,
    query_id: Option<String>,
) -> Result<QueryResult, String> {
    let driver = {
        let drivers = state.active_drivers.lock().await;
        drivers
            .get(&connection_id)
            .cloned()
            .ok_or("Connection not active")?
    };
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    let result = if let Some(qid) = query_id {
        let ct = CancellationToken::new();
        state
            .cancellation_tokens
            .lock()
            .await
            .insert(qid.clone(), ct.clone());

        let res = tokio::select! {
            r = driver.execute_query(&sql, limit, offset) => r,
            _ = ct.cancelled() => Err(DriverError::Query("Query cancelled".to_string())),
        };

        state.cancellation_tokens.lock().await.remove(&qid);
        res
    } else {
        driver.execute_query(&sql, limit, offset).await
    };

    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_query(
    state: State<'_, AppState>,
    query_id: String,
) -> Result<(), String> {
    let tokens = state.cancellation_tokens.lock().await;
    match tokens.get(&query_id) {
        Some(token) => {
            token.cancel();
            Ok(())
        }
        None => Err("Query not found".to_string()),
    }
}

#[tauri::command]
pub async fn list_columns(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    let drivers = state.active_drivers.lock().await;
    let driver = drivers.get(&connection_id).ok_or("Connection not active")?;
    driver
        .list_columns(&schema, &table)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ping_connection(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let driver = {
        let drivers = state.active_drivers.lock().await;
        drivers.get(&id).cloned()
    };
    match driver {
        Some(d) => match d.test().await {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        },
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn reconnect_connection(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    {
        let mut drivers = state.active_drivers.lock().await;
        drivers.remove(&id);
    }
    let row = sqlx::query("SELECT connection_type, url FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.storage)
        .await
        .map_err(|e| e.to_string())?;

    let type_str: &str = row.get("connection_type");
    let url: String = row.get("url");
    let connection_type = match type_str {
        "postgres" => ConnectionType::Postgres,
        _ => ConnectionType::Sqlite,
    };

    let driver = Driver::connect(&connection_type, &url)
        .await
        .map_err(|e| e.to_string())?;
    state.active_drivers.lock().await.insert(id, driver);
    Ok(())
}
