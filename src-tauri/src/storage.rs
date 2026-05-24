use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
use std::str::FromStr;

pub async fn init_pool(data_dir: &Path) -> Result<SqlitePool, anyhow::Error> {
    std::fs::create_dir_all(data_dir)?;
    let db_path = data_dir.join("tabffy.db");

    let options = SqliteConnectOptions::from_str(&format!(
        "sqlite://{}?mode=rwc",
        db_path.to_str().unwrap_or_default()
    ))?
    .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS connections (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            connection_type TEXT NOT NULL,
            url TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS saved_queries (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            sql TEXT NOT NULL,
            connection_id TEXT,
            color TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS query_history (
            id TEXT PRIMARY KEY NOT NULL,
            sql TEXT NOT NULL,
            connection_id TEXT,
            executed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS open_tabs (
            tab_id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            sql TEXT NOT NULL DEFAULT '',
            connection_id TEXT,
            saved_query_id TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 0
        );
        "#,
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}
