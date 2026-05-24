import { useState, useCallback, useRef, useEffect } from "react";
import {
  Play,
  Square,
  Save,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Keyboard,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  AlertCircle,
  Copy,
  Download,
  AlignLeft,
} from "lucide-react";
import { format as sqlFormat } from "sql-formatter";
import { EditorView, keymap, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from "@codemirror/search";
import { cn } from "@/lib/utils";
import { executeQuery, cancelQuery, listTables, listColumns, addQueryHistory } from "@/api";
import { useSettings } from "@/contexts/SettingsContext";
import type { Theme } from "@/contexts/SettingsContext";
import { SaveQueryModal } from "@/components/SaveQueryModal";
import type { ColumnInfo, Connection, QueryTab, QueryResult, SavedQuery } from "@/types";

const PAGE_SIZE = 100;

export function EditorArea({
  sidebarOpen,
  onToggleSidebar,
  tabs,
  activeTabId,
  activeTab,
  connections,
  onTabChange,
  onAddTab,
  onCloseTab,
  onUpdateTab,
  onSavedQueriesChange,
  onDuplicateTab,
  onReorderTabs,
  saveTrigger,
  searchAction,
  resultsTrigger,
  formatTrigger,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  tabs: QueryTab[];
  activeTabId: string;
  activeTab: QueryTab;
  connections: Connection[];
  onTabChange: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onUpdateTab: (id: string, patch: Partial<QueryTab>) => void;
  savedQueries: SavedQuery[];
  onSavedQueriesChange: (queries: SavedQuery[]) => void;
  onDuplicateTab: (tab: QueryTab) => void;
  onReorderTabs: (fromIndex: number, toIndex: number) => void;
  saveTrigger: number;
  searchAction: { type: string; ts: number } | null;
  resultsTrigger: number;
  formatTrigger: number;
}) {
  const { settings } = useSettings();
  const [resultsOpen, setResultsOpen] = useState(true);
  const [splitRatio, setSplitRatio] = useState(0.45);
  const [schemaTables, setSchemaTables] = useState<{ name: string; schema: string }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const getActiveSqlRef = useRef<() => string>(() => activeTab.sql);
  const [prevResultsTrigger, setPrevResultsTrigger] = useState(resultsTrigger);
  if (resultsTrigger !== prevResultsTrigger && resultsTrigger !== 0) {
    setPrevResultsTrigger(resultsTrigger);
    setResultsOpen((v) => !v);
  }

  const onResultResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const container = containerRef.current;
    if (!container) return;
    const containerHeight = container.getBoundingClientRect().height;

    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !container) return;
      const rect = container.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      const ratio = Math.max(0.15, Math.min(0.85, offset / containerHeight));
      setSplitRatio(ratio);
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const showResults = resultsOpen && (activeTab.results !== null || activeTab.error !== null);

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-zinc-950">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={onTabChange}
        onAddTab={onAddTab}
        onCloseTab={onCloseTab}
        onDuplicateTab={onDuplicateTab}
        onReorderTabs={onReorderTabs}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />
      <Toolbar
        activeTab={activeTab}
        connections={connections}
        onUpdateTab={onUpdateTab}
        onToggleResults={() => setResultsOpen((v) => !v)}
        resultsOpen={resultsOpen}
        onSavedQueriesChange={onSavedQueriesChange}
        getActiveSqlRef={getActiveSqlRef}
        saveTrigger={saveTrigger}
        formatTrigger={formatTrigger}
      />
      <div ref={containerRef} className="flex flex-col flex-1 min-h-0">
        <div
          className="min-h-0 overflow-hidden"
          style={{ flex: `${showResults ? splitRatio : 1} 0 0` }}
        >
          <SQLEditor
            key={activeTab.id}
            tab={activeTab}
            onUpdateTab={onUpdateTab}
            fontSize={settings.fontSize}
            theme={settings.theme}
            connectionId={activeTab.connectionId}
            schemaTables={schemaTables}
            onSchemaTablesChange={setSchemaTables}
            getActiveSqlRef={getActiveSqlRef}
            searchAction={searchAction}
          />
        </div>

        {showResults && (
          <>
            <div
              onMouseDown={onResultResizeStart}
              className="h-[3px] shrink-0 cursor-row-resize group relative"
            >
              <div className="absolute inset-x-0 -top-1 -bottom-1 z-10" />
              <div className="h-px w-full bg-zinc-800/60 group-hover:bg-teal-400/50 transition-colors" />
            </div>
            <div
              className="min-h-0 flex flex-col"
              style={{ flex: `${1 - splitRatio} 0 0` }}
            >
              <ResultArea tab={activeTab} onUpdateTab={onUpdateTab} />
            </div>
          </>
        )}
      </div>
      <StatusBar tab={activeTab} connections={connections} />
    </div>
  );
}

function TabBar({
  tabs,
  activeTabId,
  onTabChange,
  onAddTab,
  onCloseTab,
  onDuplicateTab,
  onReorderTabs,
  sidebarOpen,
  onToggleSidebar,
}: {
  tabs: QueryTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onDuplicateTab: (tab: QueryTab) => void;
  onReorderTabs: (fromIndex: number, toIndex: number) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  return (
    <div className="flex items-center h-9 border-b border-zinc-800/60 bg-zinc-950 shrink-0">
      <button
          onClick={onToggleSidebar}
          className="flex items-center justify-center w-8 h-full text-zinc-700 hover:text-zinc-300 transition-colors shrink-0"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
        {sidebarOpen ? (
          <PanelLeftClose className="w-3.5 h-3.5" />
        ) : (
          <PanelLeftOpen className="w-3.5 h-3.5" />
        )}
      </button>

      <div className="w-px h-4 bg-zinc-800/60 shrink-0" />

      <div className="flex items-center h-full overflow-x-auto min-w-0 flex-1 scrollbar-none">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            draggable
            onDragStart={(e) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropIndex(index);
            }}
            onDragLeave={() => {
              if (dropIndex === index) setDropIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== index) {
                onReorderTabs(dragIndex, index);
              }
              setDragIndex(null);
              setDropIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDropIndex(null);
            }}
            className={cn(
              "flex items-center gap-2 px-3 h-full text-[12px] border-r border-zinc-800/40 transition-colors relative shrink-0 select-none",
              dragIndex === index ? "opacity-40" :
              activeTabId === tab.id
                ? "text-zinc-200 bg-zinc-950"
                : "text-zinc-600 bg-zinc-950/80 hover:text-zinc-400 hover:bg-zinc-900/50",
              dropIndex === index && dragIndex !== null && dragIndex !== index && "border-l-2 border-l-teal-400"
            )}
            onClick={() => onTabChange(tab.id)}
          >
            {activeTabId === tab.id && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-teal-400" />
            )}
            {!tab.savedQueryId && tab.sql.trim().length > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
            )}
            <span className="truncate max-w-[120px]">{tab.name}</span>
            <Copy
              className="w-3 h-3 text-zinc-700 hover:text-teal-400 shrink-0 ml-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateTab(tab);
              }}
            />
            <X
              className="w-3 h-3 text-zinc-700 hover:text-zinc-300 shrink-0 ml-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
            />
          </button>
        ))}
      </div>
      <button
        onClick={onAddTab}
        className="flex items-center justify-center w-7 h-full text-zinc-700 hover:text-zinc-400 transition-colors shrink-0"
        title="New tab (Ctrl+N)"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Toolbar({
  activeTab,
  connections,
  onUpdateTab,
  onToggleResults,
  resultsOpen,
  onSavedQueriesChange,
  getActiveSqlRef,
  saveTrigger,
  formatTrigger,
}: {
  activeTab: QueryTab;
  connections: Connection[];
  onUpdateTab: (id: string, patch: Partial<QueryTab>) => void;
  onToggleResults: () => void;
  resultsOpen: boolean;
  onSavedQueriesChange: (queries: SavedQuery[]) => void;
  getActiveSqlRef: { current: () => string };
  saveTrigger: number;
  formatTrigger: number;
}) {
  const [connDropdownOpen, setConnDropdownOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [prevSaveTrigger, setPrevSaveTrigger] = useState(saveTrigger);
  if (saveTrigger !== prevSaveTrigger && saveTrigger !== 0) {
    setPrevSaveTrigger(saveTrigger);
    if (activeTab.sql.trim()) setSaveModalOpen(true);
  }

  const [prevFormatTrigger, setPrevFormatTrigger] = useState(formatTrigger);
  if (formatTrigger !== prevFormatTrigger && formatTrigger !== 0) {
    setPrevFormatTrigger(formatTrigger);
    if (activeTab.sql.trim()) {
      try {
        const formatted = sqlFormat(activeTab.sql, { language: "postgresql" });
        onUpdateTab(activeTab.id, { sql: formatted });
      } catch { /* ignore parse errors */ }
    }
  }

  const connDropdownRef = useRef<HTMLDivElement>(null);
  const selectedConnection = connections.find((c) => c.id === activeTab.connectionId);

  const handleSave = useCallback(() => {
    if (!activeTab.sql.trim()) return;
    setSaveModalOpen(true);
  }, [activeTab.sql]);

  useEffect(() => {
    if (!connDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (connDropdownRef.current && !connDropdownRef.current.contains(e.target as Node)) {
        setConnDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [connDropdownOpen]);

  const runQuery = useCallback(async () => {
    if (!activeTab.connectionId) return;
    const sql = getActiveSqlRef.current();
    if (!sql.trim()) return;
    const queryId = crypto.randomUUID();
    onUpdateTab(activeTab.id, { loading: true, error: null, results: null, queryId });

    const start = performance.now();
    try {
      const offset = (activeTab.currentPage - 1) * PAGE_SIZE;
      const results = await executeQuery(
        activeTab.connectionId,
        sql,
        PAGE_SIZE,
        offset,
        queryId
      );
      const elapsed = performance.now() - start;
      onUpdateTab(activeTab.id, {
        results,
        loading: false,
        executionTime: Math.round(elapsed),
        error: null,
        queryId: null,
      });
      addQueryHistory(sql, activeTab.connectionId).catch(() => {});
    } catch (e) {
      const elapsed = performance.now() - start;
      onUpdateTab(activeTab.id, {
        error: String(e),
        loading: false,
        executionTime: Math.round(elapsed),
        queryId: null,
      });
    }
  }, [activeTab, onUpdateTab, getActiveSqlRef]);

  return (
    <div className="flex items-center gap-2 px-3 h-9 border-b border-zinc-800/60 shrink-0">
      <div ref={connDropdownRef} className="relative">
        <button
          onClick={() => setConnDropdownOpen((v) => !v)}
          title="Select connection"
          className={cn(
            "h-6 bg-zinc-800 border rounded text-[11px] px-2 outline-none cursor-pointer transition-colors flex items-center gap-1.5",
            connDropdownOpen ? "border-zinc-600 text-zinc-100" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
          )}
        >
          <span className="truncate">{selectedConnection ? selectedConnection.name : "Connection"}</span>
          <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50" />
        </button>
        {connDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-zinc-800 border border-zinc-700 rounded-md shadow-lg shadow-black/40 py-1">
            {connections.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onUpdateTab(activeTab.id, { connectionId: c.id });
                  setConnDropdownOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-[11px] transition-colors",
                  c.id === activeTab.connectionId
                    ? "text-teal-400 bg-teal-500/10"
                    : "text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-zinc-800/60" />

      <div className="flex items-center gap-0.5">
        <button
          onClick={activeTab.loading ? async () => {
            if (activeTab.queryId) {
              try { await cancelQuery(activeTab.queryId); } catch { /* query already completed */ }
            }
          } : runQuery}
          disabled={!activeTab.loading && !activeTab.connectionId}
          title={activeTab.loading ? "Stop query (Ctrl+Enter to run)" : "Run query (Ctrl+Enter)"}
          className={cn(
            "flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium transition-colors border",
            activeTab.loading
              ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
              : "bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {activeTab.loading ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              Run
            </>
          )}
        </button>
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <button
          onClick={() => {
            if (!activeTab.sql.trim()) return;
            try {
              const formatted = sqlFormat(activeTab.sql, { language: "postgresql" });
              onUpdateTab(activeTab.id, { sql: formatted });
            } catch { /* ignore parse errors */ }
          }}
          className="flex items-center justify-center w-6 h-6 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          title="Format SQL"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleSave}
          className="flex items-center justify-center w-6 h-6 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          title="Save query"
        >
          <Save className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggleResults}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md transition-colors",
            resultsOpen ? "text-zinc-600 hover:text-zinc-300" : "text-teal-400 hover:text-teal-300"
          )}
          title={resultsOpen ? "Hide results" : "Show results"}
        >
          <ChevronsUpDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <SaveQueryModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        tab={activeTab}
        onUpdateTab={onUpdateTab}
        onSavedQueriesChange={onSavedQueriesChange}
      />
    </div>
  );
}

const editorLightTheme = EditorView.theme({
  "&": { color: "#18181b", backgroundColor: "#ffffff" },
  ".cm-gutters": { backgroundColor: "#f4f4f5", color: "#71717a", borderRight: "1px solid #e4e4e7" },
  ".cm-activeLineGutter": { backgroundColor: "#e4e4e7" },
  ".cm-activeLine": { backgroundColor: "#f4f4f580" },
  ".cm-selectionBackground": { backgroundColor: "#a5f3fc40 !important" },
  ".cm-cursor": { borderLeftColor: "#18181b" },
  ".cm-matchingBracket": { backgroundColor: "#a5f3fc40", outline: "1px solid #14b8a6" },
  ".cm-tooltip": { backgroundColor: "#ffffff", border: "1px solid #e4e4e7" },
  ".cm-tooltip-autocomplete": { backgroundColor: "#ffffff", border: "1px solid #e4e4e7" },
  ".cm-tooltip-autocomplete > ul > li": { color: "#18181b" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "#f0fdfa", color: "#0d9488" },
  ".cm-searchMatch": { backgroundColor: "#fde68a80" },
  ".cm-searchMatch-selected": { backgroundColor: "#fbbf2480" },
});

function schemaCompletionSource(
  tables: { name: string; schema: string }[],
  getColumns: (table: string) => Promise<ColumnInfo[]>
) {
  return function contextSource(context: CompletionContext): CompletionResult | null {
    const word = context.matchBefore(/[\w.]+/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const text = word.text.toLowerCase();
    const parts = text.split(".");

    if (parts.length === 2) {
      const prefix = parts[1];
      return {
        from: word.to - prefix.length,
        options: tables
          .filter((t) => t.name.toLowerCase().startsWith(parts[0]))
          .flatMap((t) => {
            const cols: { label: string; type: string; detail: string }[] = [];
            getColumns(t.name).then((columns) => {
              for (const c of columns) {
                cols.push({
                  label: c.name,
                  type: "property",
                  detail: c.data_type,
                });
              }
            });
            return cols.length > 0
              ? cols
              : [{ label: "*", type: "property", detail: "all columns" }];
          })
          .filter((o) => o.label.toLowerCase().startsWith(prefix)),
      };
    }

    const tableOptions = tables.map((t) => ({
      label: t.name,
      type: "type" as const,
      detail: t.schema,
    }));

    const sqlKeywords = [
      "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
      "DELETE", "CREATE", "TABLE", "DROP", "ALTER", "ADD", "COLUMN", "INDEX",
      "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "ON", "AND", "OR", "NOT",
      "NULL", "IS", "IN", "LIKE", "BETWEEN", "EXISTS", "DISTINCT", "GROUP",
      "BY", "ORDER", "ASC", "DESC", "HAVING", "LIMIT", "OFFSET", "UNION",
      "ALL", "AS", "CASE", "WHEN", "THEN", "ELSE", "END", "TRUE", "FALSE",
      "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "CHECK", "UNIQUE",
      "CONSTRAINT", "VIEW", "IF", "BEGIN", "COMMIT", "ROLLBACK", "CASCADE",
      "GRANT", "REVOKE", "SCHEMA", "DATABASE", "TABLESPACE", "RETURNING",
      "WITH", "RECURSIVE", "OVER", "PARTITION", "WINDOW", "ROW", "ROWS",
      "RANGE", "FETCH", "NEXT", "ONLY", "ILIKE", "SIMILAR", "TO", "LATERAL",
    ].map((kw) => ({ label: kw, type: "keyword" as const }));

    const options = [...tableOptions, ...sqlKeywords].filter((o) =>
      o.label.toLowerCase().startsWith(text)
    );

    if (options.length === 0) return null;

    return { from: word.from, options };
  };
}

function SQLEditor({
  tab,
  onUpdateTab,
  fontSize,
  theme,
  connectionId,
  schemaTables,
  onSchemaTablesChange,
  getActiveSqlRef,
  searchAction,
}: {
  tab: QueryTab;
  onUpdateTab: (id: string, patch: Partial<QueryTab>) => void;
  fontSize: number;
  theme: Theme;
  connectionId: string | null;
  schemaTables: { name: string; schema: string }[];
  onSchemaTablesChange: (tables: { name: string; schema: string }[]) => void;
  getActiveSqlRef: { current: () => string };
  searchAction: { type: string; ts: number } | null;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onUpdateTabRef = useRef(onUpdateTab);
  const tabRef = useRef(tab);
  const schemaTablesRef = useRef(schemaTables);

  useEffect(() => {
    onUpdateTabRef.current = onUpdateTab;
    tabRef.current = tab;
    schemaTablesRef.current = schemaTables;
    getActiveSqlRef.current = () => {
      const view = viewRef.current;
      if (!view) return tabRef.current.sql;
      const { from, to } = view.state.selection.main;
      if (from !== to) return view.state.sliceDoc(from, to);
      return view.state.doc.toString();
    };
  });

  useEffect(() => {
    if (!connectionId) return;
    (async () => {
      try {
        const schemas = await import("@/api").then((m) => m.listSchemas(connectionId));
        const publicSchema = schemas.find((s) => s.name === "public") || schemas[0];
        if (publicSchema) {
          const tables = await listTables(connectionId, publicSchema.name);
          onSchemaTablesChange(tables);
        }
      } catch {
        onSchemaTablesChange([]);
      }
    })();
  }, [connectionId, onSchemaTablesChange]);

  const getColumnsRef = useRef(async (table: string): Promise<ColumnInfo[]> => {
    if (!connectionId) return [];
    try {
      const schemas = await import("@/api").then((m) => m.listSchemas(connectionId));
      const publicSchema = schemas.find((s) => s.name === "public") || schemas[0];
      if (publicSchema) {
        return listColumns(connectionId, publicSchema.name, table);
      }
    } catch { /* ignore */ }
    return [];
  });

  useEffect(() => {
    if (!searchAction || !viewRef.current) return;
    openSearchPanel(viewRef.current);
  }, [searchAction]);

  const runQueryInEditor = useCallback(() => {
    const view = viewRef.current;
    let sql: string;
    if (view) {
      const { from, to } = view.state.selection.main;
      sql = from !== to ? view.state.sliceDoc(from, to) : view.state.doc.toString();
    } else {
      sql = tabRef.current.sql;
    }
    const connId = tabRef.current.connectionId;
    if (!connId || !sql.trim() || tabRef.current.loading) return;
    const queryId = crypto.randomUUID();
    onUpdateTabRef.current(tabRef.current.id, { loading: true, error: null, results: null, queryId });

    const start = performance.now();
    const offset = (tabRef.current.currentPage - 1) * PAGE_SIZE;
    executeQuery(connId, sql, PAGE_SIZE, offset, queryId)
      .then((results) => {
        const elapsed = performance.now() - start;
        onUpdateTabRef.current(tabRef.current.id, {
          results,
          loading: false,
          executionTime: Math.round(elapsed),
          error: null,
          queryId: null,
        });
        addQueryHistory(sql, connId).catch(() => {});
      })
      .catch((e) => {
        const elapsed = performance.now() - start;
        onUpdateTabRef.current(tabRef.current.id, {
          error: String(e),
          loading: false,
          executionTime: Math.round(elapsed),
          queryId: null,
        });
      });
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: tab.sql,
      extensions: [
        sql(),
        theme === "dark" ? oneDark : editorLightTheme,
        autocompletion({
          override: [
            schemaCompletionSource(
              schemaTablesRef.current,
              getColumnsRef.current
            ),
          ],
        }),
        highlightSelectionMatches(),
        keymap.of([
          {
            key: "Ctrl-Enter",
            run: () => {
              runQueryInEditor();
              return true;
            },
          },
          ...searchKeymap,
        ]),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            onUpdateTabRef.current(tabRef.current.id, { sql: update.state.doc.toString() });
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: `${fontSize}px` },
          ".cm-scroller": { overflow: "auto", fontFamily: "monospace" },
          ".cm-content": { padding: "12px 0" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [tab.id, runQueryInEditor, fontSize, theme, schemaTables]);

  return <div ref={editorRef} className="h-full w-full" />;
}

function ResultArea({
  tab,
  onUpdateTab,
}: {
  tab: QueryTab;
  onUpdateTab: (id: string, patch: Partial<QueryTab>) => void;
}) {
  if (tab.error) {
    return (
      <div className="flex items-start gap-2 p-3 h-full">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <pre className="text-[12px] text-red-300 whitespace-pre-wrap">{tab.error}</pre>
      </div>
    );
  }

  if (!tab.results) return null;

  return <ResultGrid results={tab.results} tab={tab} onUpdateTab={onUpdateTab} />;
}

function ResultGrid({
  results,
  tab,
  onUpdateTab,
}: {
  results: QueryResult;
  tab: QueryTab;
  onUpdateTab: (id: string, patch: Partial<QueryTab>) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(results.rows.length / PAGE_SIZE));
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const goToPage = useCallback(
    (page: number) => {
      onUpdateTab(tab.id, { currentPage: page });
    },
    [tab.id, onUpdateTab]
  );

  const copyCell = useCallback(() => {
    if (!selectedCell) return;
    const row = results.rows[selectedCell.row];
    const col = results.columns[selectedCell.col];
    const value = row[col];
    navigator.clipboard.writeText(value === null ? "NULL" : String(value));
  }, [selectedCell, results]);

  const copyRowAsJson = useCallback(
    (rowIndex: number) => {
      const row = results.rows[rowIndex];
      const obj: Record<string, unknown> = {};
      for (const col of results.columns) {
        obj[col] = row[col];
      }
      navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    },
    [results]
  );

  const copyRowAsCsv = useCallback(
    (rowIndex: number) => {
      const row = results.rows[rowIndex];
      const values = results.columns.map((col) => {
        const v = row[col];
        if (v === null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      });
      navigator.clipboard.writeText(values.join(","));
    },
    [results]
  );

  const exportCsv = useCallback(() => {
    const header = results.columns.join(",");
    const rows = results.rows.map((row) =>
      results.columns
        .map((col) => {
          const v = row[col];
          if (v === null) return "";
          const s = String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    );
    navigator.clipboard.writeText([header, ...rows].join("\n"));
  }, [results]);

  const exportJson = useCallback(() => {
    const data = results.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const col of results.columns) {
        obj[col] = row[col];
      }
      return obj;
    });
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }, [results]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        copyCell();
      }
    },
    [copyCell]
  );

  if (results.columns.length === 0 && results.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-zinc-600">
        No results
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-900 border-b border-zinc-800/60">
              {results.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500 tracking-wide whitespace-nowrap border-r border-zinc-800/30 last:border-r-0"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-zinc-800/20 hover:bg-teal-500/[0.04] transition-colors group/row",
                )}
                onContextMenu={(e) => {
                  e.preventDefault();
                }}
              >
                {results.columns.map((col, ci) => {
                  const isSelected =
                    selectedCell?.row === i && selectedCell?.col === ci;
                  return (
                    <td
                      key={col}
                      className={cn(
                        "px-3 py-[5px] whitespace-nowrap border-r border-zinc-800/15 last:border-r-0 max-w-[300px] truncate relative",
                        ci === 0
                          ? "text-zinc-300 font-mono text-[11px]"
                          : "text-zinc-400",
                        isSelected && "bg-teal-500/10 ring-1 ring-teal-500/30 ring-inset"
                      )}
                      title={String(row[col] ?? "")}
                      onClick={() => setSelectedCell({ row: i, col: ci })}
                    >
                      {row[col] === null ? (
                        <span className="text-zinc-700 italic">NULL</span>
                      ) : (
                        String(row[col])
                      )}
                      {isSelected && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyCell();
                            }}
                            className="p-0.5 text-zinc-600 hover:text-teal-400 transition-colors"
                            title="Copy cell"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-1 py-[5px] opacity-0 group-hover/row:opacity-100">
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => copyRowAsJson(i)}
                      className="p-0.5 text-zinc-600 hover:text-teal-400 transition-colors text-[9px] whitespace-nowrap"
                      title="Copy row as JSON"
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => copyRowAsCsv(i)}
                      className="p-0.5 text-zinc-600 hover:text-teal-400 transition-colors text-[9px] whitespace-nowrap"
                      title="Copy row as CSV"
                    >
                      CSV
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 h-7 border-t border-zinc-800/60 shrink-0 bg-zinc-950">
        <span className="text-[10px] text-zinc-600">
          {results.rows.length} row{results.rows.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1 p-0.5 text-[10px] text-zinc-600 hover:text-teal-400 transition-colors"
            title="Copy all as CSV"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={exportJson}
            className="flex items-center gap-1 p-0.5 text-[10px] text-zinc-600 hover:text-teal-400 transition-colors"
            title="Copy all as JSON"
          >
            <Download className="w-3 h-3" />
            JSON
          </button>
          <div className="w-px h-3 bg-zinc-800/60" />
          <div className="flex items-center gap-1.5">
            <button
              className="p-0.5 text-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-30"
              disabled={tab.currentPage <= 1}
              onClick={() => goToPage(tab.currentPage - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-zinc-500 tabular-nums min-w-[40px] text-center">
              {tab.currentPage} / {totalPages}
            </span>
            <button
              className="p-0.5 text-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-30"
              disabled={tab.currentPage >= totalPages}
              onClick={() => goToPage(tab.currentPage + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar({
  tab,
  connections,
}: {
  tab: QueryTab;
  connections: Connection[];
}) {
  const conn = connections.find((c) => c.id === tab.connectionId);

  return (
    <div className="flex items-center justify-between px-3 h-6 border-t border-zinc-800/60 bg-zinc-950 shrink-0">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[10px] text-zinc-600">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              conn ? "bg-emerald-500" : "bg-zinc-700"
            )}
          />
          {conn ? "Connected" : "No connection"}
        </span>
        {conn && (
          <span className="text-[10px] text-zinc-700">{conn.name}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {tab.executionTime !== null && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-700">
            <Clock className="w-2.5 h-2.5" />
            {tab.executionTime}ms
          </span>
        )}
        <span className="flex items-center gap-1 text-[10px] text-zinc-700">
          <Keyboard className="w-2.5 h-2.5" />
          Ctrl+Enter Run
        </span>
      </div>
    </div>
  );
}
