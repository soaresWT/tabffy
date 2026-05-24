use async_trait::async_trait;
use thiserror::Error;

use crate::models::{ColumnInfo, QueryResult, SchemaInfo, TableInfo};

#[derive(Error, Debug)]
pub enum DriverError {
    #[error("Connection failed: {0}")]
    Connection(String),
    #[error("Query failed: {0}")]
    Query(String),
}

impl serde::Serialize for DriverError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn test(&self) -> Result<(), DriverError>;
    async fn list_schemas(&self) -> Result<Vec<SchemaInfo>, DriverError>;
    async fn list_tables(&self, schema: &str) -> Result<Vec<TableInfo>, DriverError>;
    async fn execute_query(&self, sql: &str, limit: u32, offset: u32) -> Result<QueryResult, DriverError>;
    async fn list_columns(&self, schema: &str, table: &str) -> Result<Vec<ColumnInfo>, DriverError>;
}
