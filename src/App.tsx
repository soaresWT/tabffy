import { useState, useCallback, useRef, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { PanelLeft } from "lucide-react";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { ToastProvider } from "./contexts/ToastContext";
import { saveOpenTabs, loadOpenTabs } from "./api";
import type { Connection, QueryTab, SavedQuery, SavedTab } from "./types";

function createTab(index: number): QueryTab {
  return {
    id: crypto.randomUUID(),
    name: `Query ${index}`,
    sql: "",
    connectionId: null,
    results: null,
    error: null,
    loading: false,
    savedQueryId: null,
    executionTime: null,
    currentPage: 1,
    queryId: null,
  };
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SettingsProvider>
  );
}

function AppContent() {
  const { settings, setFontSize } = useSettings();
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tabs, setTabs] = useState<QueryTab[]>([createTab(1)]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [saveTrigger, setSaveTrigger] = useState(0);
  const [searchAction, setSearchAction] = useState<{
    type: string;
    ts: number;
  } | null>(null);
  const [resultsTrigger, setResultsTrigger] = useState(0);
  const [formatTrigger, setFormatTrigger] = useState(0);
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const dragging = useRef(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX;
      setSidebarWidth(Math.max(180, Math.min(420, startWidth + delta)));
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const updateTab = useCallback((id: string, patch: Partial<QueryTab>) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const addTab = useCallback(() => {
    const tab = createTab(tabs.length + 1);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [tabs.length]);

  const closeTab = useCallback(
    (id: string) => {
      const tab = tabs.find((t) => t.id === id);
      if (tab && !tab.savedQueryId && tab.sql.trim().length > 0) {
        if (!window.confirm("This tab has unsaved SQL. Close anyway?"))
          return;
      }
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) {
          const fresh = createTab(1);
          setActiveTabId(fresh.id);
          return [fresh];
        }
        if (activeTabId === id) {
          const idx = prev.findIndex((t) => t.id === id);
          const newIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[newIdx].id);
        }
        return next;
      });
    },
    [activeTabId, tabs]
  );

  const duplicateTab = useCallback((tab: QueryTab) => {
    const newTab: QueryTab = {
      id: crypto.randomUUID(),
      name: `${tab.name} (copy)`,
      sql: tab.sql,
      connectionId: tab.connectionId,
      results: null,
      error: null,
      loading: false,
      savedQueryId: null,
      executionTime: null,
      currentPage: 1,
      queryId: null,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const reorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTabs((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "new_tab":
          addTab();
          break;
        case "close_tab":
          closeTab(activeTabId);
          break;
        case "save_query":
          setSaveTrigger(Date.now());
          break;
        case "toggle_sidebar":
          setSidebarOpen((v) => !v);
          break;
        case "toggle_results":
          setResultsTrigger(Date.now());
          break;
        case "find":
          setSearchAction({ type: "find", ts: Date.now() });
          break;
        case "replace":
          setSearchAction({ type: "replace", ts: Date.now() });
          break;
        case "zoom_in":
          setFontSize(Math.min(32, settings.fontSize + 1));
          break;
        case "zoom_out":
          setFontSize(Math.max(8, settings.fontSize - 1));
          break;
        case "zoom_reset":
          setFontSize(12);
          break;
        case "format_sql":
          setFormatTrigger(Date.now());
          break;
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [addTab, closeTab, activeTabId, settings.fontSize, setFontSize]);

  useEffect(() => {
    loadOpenTabs()
      .then((saved) => {
        if (saved && saved.length > 0) {
          const loadedTabs: QueryTab[] = saved.map((st: SavedTab) => ({
            id: st.tab_id,
            name: st.name,
            sql: st.sql,
            connectionId: st.connection_id,
            results: null,
            error: null,
            loading: false,
            savedQueryId: st.saved_query_id,
            executionTime: null,
            currentPage: 1,
            queryId: null,
          }));
          setTabs(loadedTabs);
          const active = saved.find((st: SavedTab) => st.is_active);
          if (active) setActiveTabId(active.tab_id);
        }
      })
      .catch(() => {})
      .finally(() => setTabsLoaded(true));
  }, []);

  useEffect(() => {
    if (!tabsLoaded) return;
    const timeout = setTimeout(() => {
      const saved: SavedTab[] = tabs.map((t, i) => ({
        tab_id: t.id,
        name: t.name,
        sql: t.sql,
        connection_id: t.connectionId,
        saved_query_id: t.savedQueryId,
        position: i,
        is_active: t.id === activeTabId,
      }));
      saveOpenTabs(saved).catch(() => {});
    }, 500);
    return () => clearTimeout(timeout);
  }, [tabs, activeTabId, tabsLoaded]);

  const openPreview = useCallback(
    (connectionId: string, tableName: string, schemaName: string) => {
      const qualified = `"${schemaName}"."${tableName}"`;
      const sql = `SELECT * FROM ${qualified} LIMIT 5`;
      const tab: QueryTab = {
        id: crypto.randomUUID(),
        name: `${schemaName}.${tableName} preview`,
        sql,
        connectionId,
        results: null,
        error: null,
        loading: false,
        savedQueryId: null,
        executionTime: null,
        currentPage: 1,
        queryId: null,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    },
    []
  );

  const openSavedQuery = useCallback((sq: SavedQuery) => {
    const tab: QueryTab = {
      id: crypto.randomUUID(),
      name: sq.name,
      sql: sq.sql,
      connectionId: sq.connection_id,
      results: null,
      error: null,
      loading: false,
      savedQueryId: sq.id,
      executionTime: null,
      currentPage: 1,
      queryId: null,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const openHistoryQuery = useCallback(
    (sql: string, connectionId: string | null) => {
      const tab: QueryTab = {
        id: crypto.randomUUID(),
        name: "Query",
        sql,
        connectionId,
        results: null,
        error: null,
        loading: false,
        savedQueryId: null,
        executionTime: null,
        currentPage: 1,
        queryId: null,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    },
    []
  );

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {sidebarOpen ? (
        <>
          <div
            style={{ width: sidebarWidth }}
            className="shrink-0 flex overflow-hidden"
          >
            <div className="flex-1 min-w-0">
              <Sidebar
                onConnectionsChange={setConnections}
                onOpenPreview={openPreview}
                savedQueries={savedQueries}
                onSavedQueriesChange={setSavedQueries}
                onOpenSavedQuery={openSavedQuery}
                onOpenHistoryQuery={openHistoryQuery}
              />
            </div>
            <div
              onMouseDown={onResizeStart}
              className="w-[3px] shrink-0 cursor-col-resize group relative"
            >
              <div className="absolute inset-y-0 -left-1 -right-1 z-10" />
              <div className="h-full w-px bg-zinc-800/60 group-hover:bg-teal-400/50 transition-colors mx-auto" />
            </div>
          </div>
        </>
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center justify-center w-8 h-8 text-zinc-700 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors m-1.5 rounded-md shrink-0"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      <EditorArea
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        tabs={tabs}
        activeTabId={activeTabId}
        activeTab={activeTab}
        connections={connections}
        onTabChange={setActiveTabId}
        onAddTab={addTab}
        onCloseTab={closeTab}
        onUpdateTab={updateTab}
        savedQueries={savedQueries}
        onSavedQueriesChange={setSavedQueries}
        onDuplicateTab={duplicateTab}
        onReorderTabs={reorderTabs}
        saveTrigger={saveTrigger}
        searchAction={searchAction}
        resultsTrigger={resultsTrigger}
        formatTrigger={formatTrigger}
      />
    </div>
  );
}
