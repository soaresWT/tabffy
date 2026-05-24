use async_trait::async_trait;
use sqlx::postgres::PgPoolOptions;
use sqlx::{Row, Column};

use crate::models::{ColumnInfo, QueryResult, SchemaInfo, TableInfo};

use super::driver::{DatabaseDriver, DriverError};
use super::split::split_statements;

#[derive(Clone)]
pub struct PgDriver {
    pool: sqlx::PgPool,
}

impl PgDriver {
    pub async fn new(url: &str) -> Result<Self, DriverError> {
        let pool = PgPoolOptions::new()
            .max_connections(2)
            .connect(url)
            .await
            .map_err(|e| DriverError::Connection(e.to_string()))?;
        Ok(Self { pool })
    }

    async fn execute_single(&self, sql: &str, limit: u32, offset: u32) -> Result<QueryResult, DriverError> {
        let is_select = sql.trim_start().to_uppercase().starts_with("SELECT");

        if is_select {
            let wrapped = format!(
                "SELECT _subq.*, row_to_json(_subq) AS __tabffy_row FROM ({}) AS _subq LIMIT {} OFFSET {}",
                sql, limit, offset
            );
            let result = sqlx::query(&wrapped)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| DriverError::Query(e.to_string()))?;

            let mut columns: Vec<String> = Vec::new();
            if let Some(row) = result.first() {
                columns = row
                    .columns()
                    .iter()
                    .filter(|c| c.name() != "__tabffy_row")
                    .map(|c| c.name().to_string())
                    .collect();
            }

            let rows = result
                .iter()
                .map(|row| {
                    let mut map = serde_json::Map::new();
                    let json_val: Option<serde_json::Value> =
                        row.try_get("__tabffy_row").unwrap_or(None);
                    if let Some(serde_json::Value::Object(obj)) = json_val {
                        for col in &columns {
                            map.insert(
                                col.clone(),
                                obj.get(col).cloned().unwrap_or(serde_json::Value::Null),
                            );
                        }
                    } else {
                        for col in &columns {
                            map.insert(col.clone(), serde_json::Value::Null);
                        }
                    }
                    map
                })
                .collect();

            Ok(QueryResult {
                columns,
                rows,
                rows_affected: None,
            })
        } else {
            let result = sqlx::query(sql)
                .execute(&self.pool)
                .await
                .map_err(|e| DriverError::Query(e.to_string()))?;

            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: Some(result.rows_affected()),
            })
        }
    }
}

#[async_trait]
impl DatabaseDriver for PgDriver {
    async fn test(&self) -> Result<(), DriverError> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map_err(|e| DriverError::Connection(e.to_string()))?;
        Ok(())
    }

    async fn list_schemas(&self) -> Result<Vec<SchemaInfo>, DriverError> {
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema' ORDER BY nspname")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| DriverError::Query(e.to_string()))?;
        Ok(rows.into_iter().map(|(name,)| SchemaInfo { name }).collect())
    }

    async fn list_tables(&self, schema: &str) -> Result<Vec<TableInfo>, DriverError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename",
        )
        .bind(schema)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DriverError::Query(e.to_string()))?;
        Ok(rows
            .into_iter()
            .map(|(name,)| TableInfo {
                name,
                schema: schema.to_string(),
            })
            .collect())
    }

    async fn list_columns(&self, schema: &str, table: &str) -> Result<Vec<ColumnInfo>, DriverError> {
        let rows = sqlx::query_as::<_, (String, String, String)>(
            "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position",
        )
        .bind(schema)
        .bind(table)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DriverError::Query(e.to_string()))?;
        Ok(rows
            .into_iter()
            .map(|(name, data_type, is_nullable)| ColumnInfo {
                name,
                table: table.to_string(),
                schema: schema.to_string(),
                data_type,
                nullable: is_nullable == "YES",
            })
            .collect())
    }

    async fn execute_query(&self, sql: &str, limit: u32, offset: u32) -> Result<QueryResult, DriverError> {
        let statements = split_statements(sql);

        if statements.is_empty() {
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: Some(0),
            });
        }

        if statements.len() == 1 {
            return self.execute_single(&statements[0], limit, offset).await;
        }

        let mut total_rows_affected: u64 = 0;
        let mut last_result: Option<QueryResult> = None;

        for stmt in &statements {
            let result = self.execute_single(stmt, limit, offset).await?;
            total_rows_affected += result.rows_affected.unwrap_or(0);
            last_result = Some(result);
        }

        let mut final_result = last_result.unwrap_or(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected: None,
        });
        final_result.rows_affected = Some(total_rows_affected);

        Ok(final_result)
    }
}
