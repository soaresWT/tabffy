import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Database,
  ChevronRight,
  ChevronDown,
  Table2,
  Search,
  Circle,
  FolderClosed,
  FolderOpen,
  Plug,
  PlugZap,
  Loader2,
  Trash2,
  RefreshCw,
  Trash2 as Trash2Icon,
  Settings as SettingsIcon,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AddConnectionModal } from "./AddConnectionModal";
import { SettingsModal } from "./SettingsModal";
import {
  listConnections,
  deleteConnection,
  activateConnection,
  deactivateConnection,
  listSchemas,
  listTables,
  listSavedQueries,
  deleteQuery as deleteSavedQuery,
  listQueryHistory,
  clearQueryHistory,
  pingConnection,
  reconnectConnection,
} from "@/api";
import type { Connection, SchemaInfo, TableInfo, SavedQuery, QueryHistoryEntry } from "@/types";
import { useToast } from "@/contexts/ToastContext";

interface SchemaState {
  info: SchemaInfo;
  expanded: boolean;
  tables: TableInfo[];
  loading: boolean;
}

interface ConnectionState {
  conn: Connection;
  active: boolean;
  expanded: boolean;
  loading: boolean;
  schemas: SchemaState[];
}

export function Sidebar({
  onConnectionsChange,
  onOpenPreview,
  savedQueries,
  onSavedQueriesChange,
  onOpenSavedQuery,
  onOpenHistoryQuery,
}: {
  onConnectionsChange: (conns: Connection[]) => void;
  onOpenPreview: (connectionId: string, tableName: string, schemaName: string) => void;
  savedQueries: SavedQuery[];
  onSavedQueriesChange: (queries: SavedQuery[]) => void;
  onOpenSavedQuery: (query: SavedQuery) => void;
  onOpenHistoryQuery: (sql: string, connectionId: string | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<"tables" | "queries" | "history">("tables");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [connections, setConnections] = useState<ConnectionState[]>([]);
  const { toast } = useToast();

  const refreshConnections = useCallback(async () => {
    try {
      const conns = await listConnections();
      onConnectionsChange(conns);
      setConnections((prev) =>
        conns.map((conn) => {
          const existing = prev.find((c) => c.conn.id === conn.id);
          return {
            conn,
            active: existing?.active ?? false,
            expanded: existing?.expanded ?? false,
            loading: false,
            schemas: existing?.schemas ?? [],
          };
        })
      );
    } catch (e) {
      console.error("Failed to load connections:", e);
    }
  }, [onConnectionsChange]);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      refreshConnections();
    }
  }, [refreshConnections]);

  const connectionsRef = useRef(connections);
  useEffect(() => {
    connectionsRef.current = connections;
  });

  useEffect(() => {
    const interval = setInterval(async () => {
      const active = connectionsRef.current.filter((c) => c.active);
      for (const cs of active) {
        try {
          const alive = await pingConnection(cs.conn.id);
          if (!alive) {
            toast(`Connection "${cs.conn.name}" lost, reconnecting...`, "info");
            try {
              await reconnectConnection(cs.conn.id);
              const schemas = await listSchemas(cs.conn.id);
              setConnections((prev) =>
                prev.map((c) =>
                  c.conn.id === cs.conn.id
                    ? {
                        ...c,
                        active: true,
                        schemas: schemas.map((s) => ({
                          info: s,
                          expanded: false,
                          tables: [],
                          loading: false,
                        })),
                      }
                    : c
                )
              );
              toast(`Connection "${cs.conn.name}" reconnected`, "success");
            } catch {
              setConnections((prev) =>
                prev.map((c) =>
                  c.conn.id === cs.conn.id
                    ? { ...c, active: false, expanded: false, schemas: [] }
                    : c
                )
              );
              toast(`Connection "${cs.conn.name}" reconnection failed`, "error");
            }
          }
        } catch { /* ignore */ }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  const handleConnectionSaved = useCallback(() => {
    refreshConnections();
  }, [refreshConnections]);

  const toggleConnection = useCallback(
    async (id: string) => {
      const cs = connections.find((c) => c.conn.id === id);
      if (!cs) return;

      if (cs.active) {
        try {
          await deactivateConnection(id);
          setConnections((prev) =>
            prev.map((c) =>
              c.conn.id === id
                ? { ...c, active: false, expanded: false, schemas: [] }
                : c
            )
          );
          toast("Connection deactivated", "info");
        } catch (e) {
          console.error("Failed to deactivate:", e);
          toast("Failed to deactivate connection", "error");
        }
      } else {
        setConnections((prev) =>
          prev.map((c) => (c.conn.id === id ? { ...c, loading: true } : c))
        );
        try {
          await activateConnection(id);
          const schemas = await listSchemas(id);
          setConnections((prev) =>
            prev.map((c) =>
              c.conn.id === id
                ? {
                    ...c,
                    active: true,
                    expanded: true,
                    loading: false,
                    schemas: schemas.map((s) => ({
                      info: s,
                      expanded: false,
                      tables: [],
                      loading: false,
                    })),
                  }
                : c
            )
          );
          toast("Connection activated", "success");
        } catch (e) {
          console.error("Failed to activate:", e);
          toast("Failed to activate connection", "error");
          setConnections((prev) =>
            prev.map((c) => (c.conn.id === id ? { ...c, loading: false } : c))
          );
        }
      }
    },
    [connections, toast]
  );

  const toggleExpand = useCallback(
    async (id: string) => {
      const cs = connections.find((c) => c.conn.id === id);
      if (!cs) return;

      const nextExpanded = !cs.expanded;

      if (nextExpanded && cs.active && cs.schemas.length === 0) {
        setConnections((prev) =>
          prev.map((c) => (c.conn.id === id ? { ...c, loading: true } : c))
        );
        try {
          const schemas = await listSchemas(id);
          setConnections((prev) =>
            prev.map((c) =>
              c.conn.id === id
                ? {
                    ...c,
                    expanded: true,
                    loading: false,
                    schemas: schemas.map((s) => ({
                      info: s,
                      expanded: false,
                      tables: [],
                      loading: false,
                    })),
                  }
                : c
            )
          );
        } catch (e) {
          console.error("Failed to load schemas:", e);
          setConnections((prev) =>
            prev.map((c) => (c.conn.id === id ? { ...c, loading: false } : c))
          );
        }
      } else {
        setConnections((prev) =>
          prev.map((c) =>
            c.conn.id === id ? { ...c, expanded: nextExpanded } : c
          )
        );
      }
    },
    [connections]
  );

  const toggleSchema = useCallback(
    async (connId: string, schemaName: string) => {
      const cs = connections.find((c) => c.conn.id === connId);
      if (!cs) return;
      const ss = cs.schemas.find((s) => s.info.name === schemaName);
      if (!ss) return;

      const nextExpanded = !ss.expanded;

      if (nextExpanded && ss.tables.length === 0) {
        setConnections((prev) =>
          prev.map((c) =>
            c.conn.id === connId
              ? {
                  ...c,
                  schemas: c.schemas.map((s) =>
                    s.info.name === schemaName ? { ...s, loading: true } : s
                  ),
                }
              : c
          )
        );
        try {
          const tables = await listTables(connId, schemaName);
          setConnections((prev) =>
            prev.map((c) =>
              c.conn.id === connId
                ? {
                    ...c,
                    schemas: c.schemas.map((s) =>
                      s.info.name === schemaName
                        ? { ...s, expanded: true, loading: false, tables }
                        : s
                    ),
                  }
                : c
            )
          );
        } catch (e) {
          console.error("Failed to load tables:", e);
          setConnections((prev) =>
            prev.map((c) =>
              c.conn.id === connId
                ? {
                    ...c,
                    schemas: c.schemas.map((s) =>
                      s.info.name === schemaName
                        ? { ...s, loading: false }
                        : s
                    ),
                  }
                : c
            )
          );
        }
      } else {
        setConnections((prev) =>
          prev.map((c) =>
            c.conn.id === connId
              ? {
                  ...c,
                  schemas: c.schemas.map((s) =>
                    s.info.name === schemaName
                      ? { ...s, expanded: nextExpanded }
                      : s
                  ),
                }
              : c
          )
        );
      }
    },
    [connections]
  );

  const handleDeleteConnection = useCallback(
    async (id: string) => {
      try {
        await deleteConnection(id);
        setConnections((prev) => prev.filter((c) => c.conn.id !== id));
        toast("Connection deleted", "info");
      } catch (e) {
        console.error("Failed to delete connection:", e);
        toast("Failed to delete connection", "error");
      }
    },
    [toast]
  );

  const refreshSavedQueries = useCallback(async () => {
    try {
      const queries = await listSavedQueries();
      onSavedQueriesChange(queries);
    } catch (e) {
      console.error("Failed to load saved queries:", e);
    }
  }, [onSavedQueriesChange]);

  const queriesLoadedRef = useRef(false);

  const handleDeleteSavedQuery = useCallback(
    async (id: string) => {
      try {
        await deleteSavedQuery(id);
        onSavedQueriesChange(savedQueries.filter((q) => q.id !== id));
      } catch (e) {
        console.error("Failed to delete saved query:", e);
      }
    },
    [savedQueries, onSavedQueriesChange]
  );

  return (
    <div className="flex flex-col w-full h-full border-r border-zinc-800/60 bg-zinc-950">
      <SidebarHeader onOpenSettings={() => setSettingsOpen(true)} />
      <SidebarTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === "queries" && !queriesLoadedRef.current) {
            queriesLoadedRef.current = true;
            refreshSavedQueries();
          }
        }}
      />
      <div className="flex-1 overflow-y-auto">
        {activeTab === "tables" ? (
          <TablesTab
            connections={connections}
            onAddConnection={() => setAddModalOpen(true)}
            onToggleConnection={toggleConnection}
            onToggleExpand={toggleExpand}
            onToggleSchema={toggleSchema}
            onDeleteConnection={handleDeleteConnection}
            onEditConnection={(conn) => setEditingConnection(conn)}
            onOpenPreview={onOpenPreview}
          />
        ) : activeTab === "queries" ? (
          <QueriesTab
            queries={savedQueries}
            onOpen={onOpenSavedQuery}
            onDelete={handleDeleteSavedQuery}
            onRefresh={refreshSavedQueries}
          />
        ) : (
          <HistoryTab onOpen={onOpenHistoryQuery} />
        )}
      </div>
      <AddConnectionModal
        key={editingConnection?.id ?? "new"}
        open={addModalOpen || !!editingConnection}
        onOpenChange={(open) => {
          if (!open) {
            setAddModalOpen(false);
            setEditingConnection(null);
          }
        }}
        onSaved={handleConnectionSaved}
        editingConnection={editingConnection}
      />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function SidebarHeader({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 h-11 border-b border-zinc-800/60 shrink-0">
      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-teal-500/10 border border-teal-500/20">
        <Database className="w-3 h-3 text-teal-400" />
      </div>
      <span className="text-[13px] font-semibold tracking-tight text-zinc-200">
        Tabffy
      </span>
      <button
        onClick={onOpenSettings}
        className="ml-auto p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
      >
        <SettingsIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SidebarTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: "tables" | "queries" | "history";
  onTabChange: (tab: "tables" | "queries" | "history") => void;
}) {
  return (
    <div className="flex border-b border-zinc-800/60 shrink-0">
      {(["tables", "queries", "history"] as const).map((tab) => (
        <button
          key={tab}
          className={cn(
            "flex-1 py-2 text-[11px] font-medium tracking-wide uppercase transition-colors relative",
            activeTab === tab
              ? "text-zinc-200"
              : "text-zinc-600 hover:text-zinc-400"
          )}
          onClick={() => onTabChange(tab)}
        >
          {tab}
          {activeTab === tab && (
            <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-teal-400 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

function TablesTab({
  connections,
  onAddConnection,
  onToggleConnection,
  onToggleExpand,
  onToggleSchema,
  onDeleteConnection,
  onEditConnection,
  onOpenPreview,
}: {
  connections: ConnectionState[];
  onAddConnection: () => void;
  onToggleConnection: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggleSchema: (connId: string, schema: string) => void;
  onDeleteConnection: (id: string) => void;
  onEditConnection: (conn: Connection) => void;
  onOpenPreview: (connectionId: string, tableName: string, schemaName: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredConnections = search.trim()
    ? connections.map((cs) => ({
        ...cs,
        expanded: true,
        schemas: cs.schemas.map((ss) => ({
          ...ss,
          expanded: true,
          tables: ss.tables.filter((t) =>
            t.name.toLowerCase().includes(search.toLowerCase())
          ),
        })).filter((ss) => ss.tables.length > 0 || search === ""),
      })).filter((cs) =>
        cs.conn.name.toLowerCase().includes(search.toLowerCase()) ||
        cs.schemas.some((ss) => ss.tables.length > 0)
      )
    : connections;

  return (
    <div className="py-1.5">
      <div className="px-3 pb-2 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-800/60">
          <Search className="w-3 h-3 text-zinc-600 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tables..."
            className="bg-transparent text-[12px] text-zinc-300 placeholder-zinc-700 outline-none w-full"
          />
        </div>
      </div>
      <button
        onClick={onAddConnection}
        className="flex items-center gap-2 w-full px-3 py-1.5 mx-0 text-[12px] text-zinc-500 hover:text-teal-400 hover:bg-zinc-900/60 transition-colors group"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded border border-dashed border-zinc-700 group-hover:border-teal-500/40 transition-colors">
          <Plus className="w-3 h-3" />
        </div>
        <span>Add Connection</span>
      </button>

      <div className="mt-0.5">
        {filteredConnections.map((cs) => (
          <ConnectionItem
            key={cs.conn.id}
            state={cs}
            onToggleConnection={onToggleConnection}
            onToggleExpand={onToggleExpand}
            onToggleSchema={onToggleSchema}
            onDelete={onDeleteConnection}
            onEdit={() => onEditConnection(cs.conn)}
            onOpenPreview={onOpenPreview}
          />
        ))}
        {connections.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] text-zinc-700">
              No connections yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionItem({
  state,
  onToggleConnection,
  onToggleExpand,
  onToggleSchema,
  onDelete,
  onEdit,
  onOpenPreview,
}: {
  state: ConnectionState;
  onToggleConnection: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggleSchema: (connId: string, schema: string) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onOpenPreview: (connectionId: string, tableName: string, schemaName: string) => void;
}) {
  const { conn, active, expanded, loading, schemas } = state;

  const handleClick = () => {
    if (!active) {
      onToggleConnection(conn.id);
    } else {
      onToggleExpand(conn.id);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 mx-1 rounded text-[12px] cursor-pointer transition-colors group",
          active
            ? "text-zinc-300 hover:bg-zinc-800/60"
            : "text-zinc-600 hover:bg-zinc-800/30"
        )}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-zinc-600 shrink-0 animate-spin" />
        ) : active && expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        )}
        <Circle
          className={cn(
            "w-[7px] h-[7px] shrink-0",
            active
              ? "fill-emerald-400 text-emerald-400"
              : "fill-zinc-700 text-zinc-700"
          )}
        />
        <span className="font-medium truncate" onClick={handleClick}>
          {conn.name}
        </span>
        <span className={cn(
          "text-[8px] px-1 rounded font-mono shrink-0 leading-none",
          conn.connection_type === "postgres"
            ? "text-blue-400 bg-blue-500/10"
            : "text-amber-400 bg-amber-500/10"
        )}>
          {conn.connection_type === "postgres" ? "PG" : "Lite"}
        </span>
        <span className="ml-auto flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-0.5 text-zinc-800 hover:text-teal-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Edit connection"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conn.id);
            }}
            className="p-0.5 text-zinc-800 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {active ? (
            <Plug
              className="w-3 h-3 text-emerald-500/60 hover:text-emerald-400 transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onToggleConnection(conn.id);
              }}
            />
          ) : (
            <PlugZap
              className="w-3 h-3 text-zinc-700 hover:text-teal-400 transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onToggleConnection(conn.id);
              }}
            />
          )}
        </span>
      </div>

      {expanded &&
        active &&
        schemas.map((schema) => (
          <SchemaItem
            key={schema.info.name}
            connId={conn.id}
            schema={schema}
            onToggle={onToggleSchema}
            onOpenPreview={onOpenPreview}
          />
        ))}

      {expanded && active && !loading && schemas.length === 0 && (
        <div className="pl-[38px] pr-3 py-1 text-[11px] text-zinc-700">
          No schemas found
        </div>
      )}
    </div>
  );
}

function SchemaItem({
  connId,
  schema,
  onToggle,
  onOpenPreview,
}: {
  connId: string;
  schema: SchemaState;
  onToggle: (connId: string, schema: string) => void;
  onOpenPreview: (connectionId: string, tableName: string, schemaName: string) => void;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1 pl-6 pr-2 py-0.5 text-[12px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
        onClick={() => onToggle(connId, schema.info.name)}
      >
        {schema.loading ? (
          <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
        ) : schema.expanded ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        {schema.expanded ? (
          <FolderOpen className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        ) : (
          <FolderClosed className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        )}
        <span className="truncate">{schema.info.name}</span>
      </div>
      {schema.expanded &&
        schema.tables.map((table) => (
          <div
            key={table.name}
            className="flex items-center gap-1.5 pl-[38px] pr-2 py-[3px] text-[12px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40 cursor-pointer transition-colors"
            onClick={() => onOpenPreview(connId, table.name, schema.info.name)}
          >
            <Table2 className="w-3 h-3 shrink-0 text-zinc-700" />
            <span className="truncate">{table.name}</span>
          </div>
        ))}
      {schema.expanded && !schema.loading && schema.tables.length === 0 && (
        <div className="pl-[38px] pr-3 py-1 text-[11px] text-zinc-700">
          No tables
        </div>
      )}
    </div>
  );
}

function QueriesTab({
  queries,
  onOpen,
  onDelete,
  onRefresh,
}: {
  queries: SavedQuery[];
  onOpen: (query: SavedQuery) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = queries.filter((q) =>
    q.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="py-1.5">
      <div className="px-3 pb-2 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-800/60">
          <Search className="w-3 h-3 text-zinc-600 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries..."
            className="bg-transparent text-[12px] text-zinc-300 placeholder-zinc-700 outline-none w-full"
          />
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-colors shrink-0"
          title="Refresh queries"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      <div className="mt-0.5">
        {filtered.map((q) => (
          <div
            key={q.id}
            className="flex items-center gap-2 px-4 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer transition-colors group"
            onClick={() => onOpen(q)}
          >
            <div
              className="w-[7px] h-[7px] rounded-full shrink-0"
              style={{
                backgroundColor: q.color ?? "#6b7280",
                boxShadow: `0 0 0 2px ${(q.color ?? "#6b7280")}33`,
              }}
            />
            <span className="truncate flex-1">{q.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(q.id);
              }}
              className="p-0.5 text-zinc-800 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {queries.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] text-zinc-700">No saved queries</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({
  onOpen,
}: {
  onOpen: (sql: string, connectionId: string | null) => void;
}) {
  const [entries, setEntries] = useState<QueryHistoryEntry[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      listQueryHistory().then(setEntries).catch(() => { /* ignore */ });
    }
  }, []);

  const handleClear = useCallback(async () => {
    try {
      await clearQueryHistory();
      setEntries([]);
    } catch { /* ignore */ }
  }, []);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h ago`;
      return d.toLocaleDateString();
    } catch { /* ignore */ }
  };

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="text-[11px] text-zinc-700">{entries.length} entries</span>
        {entries.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-[11px] text-zinc-700 hover:text-red-400 transition-colors"
          >
            <Trash2Icon className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
      <div className="space-y-0">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-col gap-0.5 px-4 py-1.5 text-[12px] hover:bg-zinc-800/40 cursor-pointer transition-colors group"
            onClick={() => onOpen(entry.sql, entry.connection_id)}
          >
            <span className="text-zinc-400 font-mono text-[11px] truncate">
              {entry.sql.length > 80 ? entry.sql.slice(0, 80) + "..." : entry.sql}
            </span>
            <span className="text-[10px] text-zinc-700">
              {formatTime(entry.executed_at)}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] text-zinc-700">No query history</p>
          </div>
        )}
      </div>
    </div>
  );
}
