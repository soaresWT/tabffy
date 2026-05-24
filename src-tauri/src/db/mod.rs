pub mod driver;
pub mod postgres_driver;
pub mod split;
pub mod sqlite_driver;

pub use driver::{DatabaseDriver, DriverError};
pub use postgres_driver::PgDriver;
pub use sqlite_driver::SqliteDriver;

use crate::models::{ColumnInfo, ConnectionType};

#[derive(Clone)]
pub enum Driver {
    Postgres(PgDriver),
    Sqlite(SqliteDriver),
}

impl Driver {
    pub async fn connect(connection_type: &ConnectionType, url: &str) -> Result<Self, DriverError> {
        match connection_type {
            ConnectionType::Postgres => {
                let driver = PgDriver::new(url).await?;
                Ok(Driver::Postgres(driver))
            }
            ConnectionType::Sqlite => {
                let driver = SqliteDriver::new(url).await?;
                Ok(Driver::Sqlite(driver))
            }
        }
    }

    pub async fn test(&self) -> Result<(), DriverError> {
        match self {
            Driver::Postgres(d) => d.test().await,
            Driver::Sqlite(d) => d.test().await,
        }
    }

    pub async fn list_schemas(&self) -> Result<Vec<crate::models::SchemaInfo>, DriverError> {
        match self {
            Driver::Postgres(d) => d.list_schemas().await,
            Driver::Sqlite(d) => d.list_schemas().await,
        }
    }

    pub async fn list_tables(
        &self,
        schema: &str,
    ) -> Result<Vec<crate::models::TableInfo>, DriverError> {
        match self {
            Driver::Postgres(d) => d.list_tables(schema).await,
            Driver::Sqlite(d) => d.list_tables(schema).await,
        }
    }

    pub async fn execute_query(
        &self,
        sql: &str,
        limit: u32,
        offset: u32,
    ) -> Result<crate::models::QueryResult, DriverError> {
        match self {
            Driver::Postgres(d) => d.execute_query(sql, limit, offset).await,
            Driver::Sqlite(d) => d.execute_query(sql, limit, offset).await,
        }
    }

    pub async fn list_columns(
        &self,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, DriverError> {
        match self {
            Driver::Postgres(d) => d.list_columns(schema, table).await,
            Driver::Sqlite(d) => d.list_columns(schema, table).await,
        }
    }
}
