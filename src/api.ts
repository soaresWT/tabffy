import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Connection, ConnectionType, QueryResult, SavedQuery, SchemaInfo, TableInfo, ColumnInfo, QueryHistoryEntry, SavedTab } from "./types";

export async function testConnection(
  connectionType: ConnectionType,
  url: string
): Promise<void> {
  await invoke("test_connection", {
    params: { type: connectionType, url },
  });
}

export async function saveConnection(
  name: string,
  url: string,
  connectionType: ConnectionType
): Promise<Connection> {
  return invoke("save_connection", {
    params: { name, url, connection_type: connectionType },
  });
}

export async function listConnections(): Promise<Connection[]> {
  return invoke("list_connections");
}

export async function deleteConnection(id: string): Promise<void> {
  await invoke("delete_connection", { id });
}

export async function updateConnection(
  id: string,
  name: string,
  url: string,
  connectionType: ConnectionType
): Promise<Connection> {
  return invoke("update_connection", { id, name, url, connectionType });
}

export async function activateConnection(id: string): Promise<void> {
  await invoke("activate_connection", { id });
}

export async function deactivateConnection(id: string): Promise<void> {
  await invoke("deactivate_connection", { id });
}

export async function isConnectionActive(id: string): Promise<boolean> {
  return invoke("is_connection_active", { id });
}

export async function listSchemas(connectionId: string): Promise<SchemaInfo[]> {
  return invoke("list_schemas", { connectionId });
}

export async function listTables(
  connectionId: string,
  schema: string
): Promise<TableInfo[]> {
  return invoke("list_tables", { connectionId, schema });
}

export async function listColumns(
  connectionId: string,
  schema: string,
  table: string
): Promise<ColumnInfo[]> {
  return invoke("list_columns", { connectionId, schema, table });
}

export async function pickSqliteFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters: [{ name: "SQLite", extensions: ["db", "sqlite", "sqlite3"] }],
  });
  return result;
}

export async function executeQuery(
  connectionId: string,
  sql: string,
  limit: number = 100,
  offset: number = 0,
  queryId: string | null = null
): Promise<QueryResult> {
  return invoke("execute_query", { connectionId, sql, limit, offset, queryId });
}

export async function cancelQuery(queryId: string): Promise<void> {
  await invoke("cancel_query", { queryId });
}

export async function saveQuery(
  name: string,
  sql: string,
  connectionId: string | null,
  color: string | null
): Promise<SavedQuery> {
  return invoke("save_query", { name, sql, connectionId, color });
}

export async function updateQuery(
  id: string,
  patch: {
    name?: string;
    sql?: string;
    connectionId?: string | null;
    color?: string | null;
  }
): Promise<SavedQuery> {
  return invoke("update_query", {
    id,
    name: patch.name,
    sql: patch.sql,
    connectionId: patch.connectionId,
    color: patch.color,
  });
}

export async function listSavedQueries(): Promise<SavedQuery[]> {
  return invoke("list_saved_queries");
}

export async function deleteQuery(id: string): Promise<void> {
  await invoke("delete_query", { id });
}

export async function addQueryHistory(
  sql: string,
  connectionId: string | null
): Promise<void> {
  await invoke("add_query_history", { sql, connectionId });
}

export async function listQueryHistory(): Promise<QueryHistoryEntry[]> {
  return invoke("list_query_history");
}

export async function clearQueryHistory(): Promise<void> {
  await invoke("clear_query_history");
}

export async function pingConnection(id: string): Promise<boolean> {
  return invoke("ping_connection", { id });
}

export async function reconnectConnection(id: string): Promise<void> {
  await invoke("reconnect_connection", { id });
}

export async function saveOpenTabs(tabs: SavedTab[]): Promise<void> {
  await invoke("save_open_tabs", { tabs });
}

export async function loadOpenTabs(): Promise<SavedTab[]> {
  return invoke("load_open_tabs");
}
