<div align="center">
  <img src="logo.png" alt="Tabffy" width="80" height="80" />
  <h1>Tabffy</h1>
  <p><strong>A fast, native desktop SQL client for PostgreSQL & SQLite</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white" alt="Rust" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Tauri_2-24C8D8?style=flat&logo=tauri&logoColor=black" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  </p>
</div>

---

**Tabffy** is a desktop database client built with [Tauri 2](https://v2.tauri.app/) (Rust + React). It connects directly to PostgreSQL and SQLite databases, letting you browse schemas, write SQL with schema-aware autocomplete, and manage queries — all in a lightweight native app that stays out of your way.

## Why Tabffy?

Existing database GUIs are heavy (Electron-based, 300MB+ installs) or limited (web-only, no native feel). Tabffy is built on **Tauri 2 with a Rust backend**, giving you direct database connectivity via [SQLx](https://github.com/launchbadge/sqlx) with a tiny footprint, fast startup, and native OS integration.

## Features

- **Multi-connection** — Register and switch between PostgreSQL and SQLite connections. Active connections show live schema trees.
- **Schema-aware autocomplete** — The editor suggests table names, column names, and SQL keywords based on the active connection's schema.
- **Query Editor** — Full-featured CodeMirror 6 editor with syntax highlighting, Find/Replace, selection execution (run only what you highlight), and one-click SQL formatting.
- **Result Grid** — Paginated results with cell copy (Ctrl+C), row copy as JSON/CSV, and export all to clipboard.
- **Tab management** — Multiple queries in tabs, drag to reorder, duplicate tabs, unsaved changes indicator, close confirmation. Tabs persist across restarts.
- **Query persistence** — Save queries with names and color labels. Full query history (last 200) with one-click replay.
- **Native menu bar** — File/Edit/View with keyboard shortcuts (Ctrl+N/W/S/F/H) that work across the app.
- **Auto-reconnect** — Periodic health checks for active connections. Dropped connections reconnect automatically with toast notifications.
- **Window state persistence** — Remembers window size and position across sessions.
- **Error boundaries** — A component crash is isolated; the rest of the app keeps running.

## Architecture

```
┌─────────────────────────────────────────────┐
│  React 19 + TypeScript + Tailwind CSS 4     │
│  CodeMirror 6 · Lucide Icons · Radix Dialog │
├─────────────────────────────────────────────┤
│  Tauri 2 IPC                                │
├─────────────────────────────────────────────┤
│  Rust Backend                               │
│  SQLx (PgPool / SqlitePool)                 │
│  Internal SQLite (connections, queries,     │
│  history, open tabs)                        │
│  CancellationToken (query cancellation)     │
└─────────────────────────────────────────────┘
```

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 6, Tailwind CSS 4, CodeMirror 6 |
| Desktop | Tauri 2 (native webview, no Electron) |
| Backend | Rust, SQLx (async PostgreSQL + SQLite driver) |
| Storage | Local SQLite (WAL mode) for app state |

## Tech Stack

| Area | Libraries |
|------|-----------|
| UI Framework | React 19, Tailwind CSS 4, Radix UI Dialog |
| SQL Editor | CodeMirror 6 (`@codemirror/lang-sql`, autocomplete, search, one-dark theme) |
| Icons | Lucide React |
| SQL Formatting | sql-formatter |
| Desktop | Tauri 2.11 (`tauri-plugin-dialog`, `tauri-plugin-window-state`, native menus) |
| DB Driver | SQLx 0.8 (async, `runtime-tokio`, `tls-rustls`) |
| Query Cancellation | `tokio_util::sync::CancellationToken` |
| Persistence | SQLite (WAL mode, `sqlx::SqlitePool`) |
| Build | Vite 8, TypeScript 6, ESLint 10 |

## Project Structure

```
src/                          # React frontend
├── App.tsx                   # Root state: tabs, connections, menu events
├── api.ts                    # Tauri invoke() wrappers (21 commands)
├── types.ts                  # Shared TypeScript types
├── components/
│   ├── EditorArea.tsx        # Tab bar, toolbar, CodeMirror, result grid, status bar
│   ├── Sidebar.tsx           # Connection tree, saved queries, query history
│   ├── AddConnectionModal.tsx
│   ├── SaveQueryModal.tsx
│   ├── SettingsModal.tsx
│   └── ErrorBoundary.tsx
└── contexts/
    ├── SettingsContext.tsx    # Theme (dark/light) + font size
    └── ToastContext.tsx       # Toast notification system

src-tauri/src/                # Rust backend
├── lib.rs                    # App bootstrap, native menu, command registration
├── state.rs                  # AppState: active drivers, cancellation tokens
├── storage.rs                # SQLite pool init + schema migration (4 tables)
├── models.rs                 # Shared Rust structs
├── commands/
│   ├── connection.rs         # 14 commands: CRUD, activate, schema introspection, ping, reconnect
│   ├── query.rs              # 4 commands: save/update/list/delete saved queries
│   ├── history.rs            # 3 commands: add/list/clear query history
│   └── tabs.rs               # 2 commands: save/load open tab state
└── db/
    ├── mod.rs                # Driver enum dispatcher
    ├── driver.rs             # DatabaseDriver trait + DriverError
    ├── postgres_driver.rs    # PgDriver (SQLx PgPool, schema introspection, query execution)
    ├── sqlite_driver.rs      # SqliteDriver (SQLx SqlitePool)
    └── split.rs              # SQL statement splitter (handles quotes, comments)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [Rust](https://www.rust-lang.org/tools/install) ≥ 1.77
- [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/)

### Install & Run

```bash
# Install frontend dependencies
npm install

# Run in development mode (opens native window with hot reload)
npm run tauri dev

# Build production binary
npm run tauri build
```

### Lint & Type Check

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript
cargo check           # Rust
```

## Codebase Highlights

- **~2,000 lines of Rust** — Clean separation: driver trait, command handlers, storage layer. Each database driver implements `DatabaseDriver` with `async_trait`, making it trivial to add new backends.
- **~2,900 lines of TypeScript/React** — Zero external state management. All state lives in `App.tsx` and flows down through props. Contexts only for theme and toasts.
- **21 Tauri IPC commands** — Type-safe communication between React and Rust via `invoke()`.
- **SQL statement splitter** (`split.rs`) — Character-by-character parser that correctly handles quoted strings, double-quoted identifiers, and line comments before splitting on semicolons.
- **Query cancellation** — `tokio::select!` with `CancellationToken` allows stopping long-running queries without killing the connection.
- **Auto-reconnect** — Background health check pings active connections every 30s. If a connection drops, it automatically reconnects and reloads the schema tree.

## Design Decisions

See [`docs/adr/`](docs/adr/) for architecture decision records:

- **[ADR 0001](docs/adr/0001-tauri-as-desktop-framework.md)** — Tauri over Electron for native PostgreSQL connectivity, smaller binaries, and lower memory usage.
- **[ADR 0002](docs/adr/0002-sqlx-for-postgresql.md)** — SQLx for compile-time query checking and async-native PostgreSQL support.
- **[ADR 0003](docs/adr/0003-hybrid-storage-sqlite-json.md)** — Hybrid storage strategy (internal SQLite for app data, live SQLx pools for user databases).

## Roadmap

See [TODO.md](TODO.md) for the full backlog. Notable upcoming features:

- Cell editing with Apply button
- Table creation wizard & DDL generation
- Data import (CSV/JSON)
- SSH tunnel support
- Auto-update (`tauri-plugin-updater`)

## License

Private project.
