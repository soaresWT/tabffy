export type ConnectionType = "postgres" | "sqlite";

export interface Connection {
  id: string;
  name: string;
  connection_type: ConnectionType;
  url: string;
}

export interface SchemaInfo {
  name: string;
}

export interface TableInfo {
  name: string;
  schema: string;
}

export interface ColumnInfo {
  name: string;
  table: string;
  schema: string;
  data_type: string;
  nullable: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rows_affected: number | null;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  connection_id: string | null;
  color: string | null;
  updated_at: string;
}

export interface QueryTab {
  id: string;
  name: string;
  sql: string;
  connectionId: string | null;
  results: QueryResult | null;
  error: string | null;
  loading: boolean;
  savedQueryId: string | null;
  executionTime: number | null;
  currentPage: number;
  queryId: string | null;
}

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  connection_id: string | null;
  executed_at: string;
}

export interface SavedTab {
  tab_id: string;
  name: string;
  sql: string;
  connection_id: string | null;
  saved_query_id: string | null;
  position: number;
  is_active: boolean;
}
