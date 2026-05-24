# Tabffy — Quality of Life & DX Backlog

## 🔴 Critical

- [x] **Data persistence** — Connections and queries live in-memory (`HashMap`). Restarting the app loses everything. ADR `0003-hybrid-storage-sqlite-json.md` already describes the solution but is not implemented.
  - `src-tauri/src/state.rs:14-19`

- [x] **Stop button does nothing** — Clicking "Stop" calls `undefined`. No query cancellation exists in the backend. Needs `CancellationToken` in Rust.
  - `src/components/EditorArea.tsx:330`

## 🟠 High Impact, Medium Effort

- [x] **Copy cells/rows** — Ctrl+C on a cell, "Copy row as JSON/CSV" in result grid. Currently the grid is read-only with no selection.
  - `src/components/EditorArea.tsx` (ResultArea)

- [x] **Export CSV/JSON** — Button in the Result Grid footer. `@tanstack/react-table` is already installed but unused.
  - `src/components/EditorArea.tsx` (ResultArea)

- [x] **Schema-aware autocomplete** — Editor only suggests SQL keywords. Needs a `list_columns` backend command and a custom CodeMirror `CompletionSource` wired to the active connection's schema.
  - `src/components/EditorArea.tsx:457`
  - `src-tauri/src/db/driver.rs:24-28`

- [x] **Find/Replace in editor** — Just needs `@codemirror/search` added to the editor extensions. Package is not in `package.json` yet.
  - `src/components/EditorArea.tsx:440-475`

- [x] **Window state persistence** — `tauri-plugin-window-state`, one line of config. Currently always opens at 800x600.
  - `src-tauri/tauri.conf.json:15-16`

- [x] **Query history** — Array in the backend storing last N executed queries. Display in a dedicated sidebar tab or dropdown.

## 🟡 Medium Impact, Low Effort

- [x] **Additional keyboard shortcuts** — `Ctrl+S` (save), `Ctrl+N` (new tab), `Ctrl+W` (close tab). Add to CodeMirror `keymap` and window listener.
  - `src/components/EditorArea.tsx:458-464`

- [x] **Search/filter tables in Table Browser** — Queries tab already has search, Tables tab doesn't. Same pattern.
  - `src/components/Sidebar.tsx:634-651` (reference), `src/components/Sidebar.tsx:470-622` (tables)

- [x] **Edit connection** — Currently only create and delete. Needs `update_connection` in Rust + reuse `AddConnectionModal` in edit mode.
  - `src-tauri/src/commands/connection.rs`
  - `src/components/AddConnectionModal.tsx`

- [x] **Tooltips on all toolbar buttons** — Run/Stop, connection dropdown, sidebar toggle are missing `title` attributes.
  - `src/components/EditorArea.tsx:328-351`

- [x] **Tab overflow scrolling** — Many tabs overflow invisibly. `overflow-x-auto` on the tab bar container fixes it.
  - `src/components/EditorArea.tsx:166-217`

- [x] **Toast notifications** — Save, connect, delete are all silent. Simple toast using Radix (already installed but unused).
  - `@radix-ui/react-toast` not installed, or use a lightweight alternative

## 🔵 Medium

- [x] **Column details in Table Browser** — Show type, nullable, default, indexes. Needs `list_columns` in the backend driver trait.
  - `src-tauri/src/db/driver.rs:24-28`

- [x] **SQL Formatter** — "Format" button in toolbar. `sql-formatter` is a lightweight dependency.

- [x] **Error boundary** — A component crash takes down the entire app. No React error boundaries exist.

- [x] **Window menu (File/Edit/View)** — Native Tauri menu with basic actions.

- [x] **Auto-reconnect** — CONTEXT.md says connections retry automatically, but there is no health check or retry mechanism.
  - `src-tauri/src/commands/connection.rs`

- [x] **Unsaved changes indicator (broken)** — `EditorArea.tsx:198` reads `tab.saved` but `QueryTab` type has no `saved` field. The dot always shows.
  - `src/components/EditorArea.tsx:198`
  - `src/types.ts:34-45`

- [x] **Tab state persistence** — Open tabs are not restored on app restart.

- [x] **Connection type indicator** — No visual distinction between PostgreSQL and SQLite in the sidebar tree.

- [x] **Schema-qualified preview SQL** — `openPreview` uses unqualified table names, will break with same-name tables in different schemas.
  - `src/App.tsx:94`

- [x] **Close tab confirmation** — Closing a tab with unsaved SQL has no confirmation.

- [x] **Run selected text** — Execute only the highlighted portion of the query editor.

- [x] **Drag to reorder tabs** — No drag-and-drop on tabs currently.

- [x] **Duplicate query/tab** — No way to clone a tab or saved query.

## 🟢 Cleanup

- [x] **Remove unused npm dependencies** — 10 packages installed but never imported:
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-popover`
  - `@radix-ui/react-scroll-area`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
  - `@radix-ui/react-slot`
  - `@radix-ui/react-tabs`
  - `@radix-ui/react-tooltip`
  - `@tanstack/react-table`
  - `class-variance-authority`

- [x] **Fix `onRefresh` prop bug** — `QueriesTab` receives `onRefresh` prop but the component type signature doesn't include it.
  - `src/components/Sidebar.tsx:351` vs `src/components/Sidebar.tsx:625-632`

## 📋 Future / Nice to Have

- [ ] Cell editing with Apply button (CONTEXT.md specifies but not implemented)
- [ ] INSERT/UPDATE/DELETE via UI
- [ ] Table creation wizard
- [ ] DDL generation ("Show CREATE TABLE")
- [ ] Data import (CSV/JSON)
- [ ] Foreign key navigation
- [ ] Views and materialized views in Table Browser
- [ ] Row count badges on tables
- [ ] Column resizing in Result Grid
- [ ] Column sorting in Result Grid
- [ ] Connection color/icon customization
- [ ] Connection grouping/folders
- [ ] SSL/TLS configuration
- [ ] SSH tunnel support
- [ ] Keybindings customization
- [ ] Default connection on startup
- [ ] Query timeout setting
- [ ] Auto-limit setting (hardcoded to 100/5)
- [ ] Editor settings (tab size, word wrap, minimap, line numbers)
- [ ] Result grid font size setting
- [ ] Auto-update (`tauri-plugin-updater`)
- [ ] System tray icon
- [ ] Single instance lock
- [ ] Loading skeletons
- [ ] Responsive layout
- [ ] Undo close tab
- [ ] Focus management after actions
- [ ] Recently opened queries
