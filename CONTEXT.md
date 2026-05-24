# Tabffy

A desktop database client focused on PostgreSQL, where users register connections, browse tables, and execute SQL queries.

## Language

**Connection**:
A saved PostgreSQL database endpoint identified by a connection URL (entered as full URL or individual fields). Users register, name, and manage multiple Connections. A Connection can be **active** (connected) or **inactive** (disconnected). On app start, all Connections are inactive; users activate manually. Dropped connections retry automatically.
_Avoid_: Database, data source, server

**Query**:
A SQL statement written and executed by the user against a selected Connection. Each Query lives in its own tab. Queries can be **saved** (named, with color labels) or remain as **drafts** (auto-saved). A dedicated tab in the sidebar lists all saved Queries.
_Avoid_: Statement, command, script

**Table Browser**:
A sidebar tree showing schemas and tables for each active Connection. Multiple Connections appear as separate expandable trees. Clicking a table opens a tab with a `SELECT * FROM ... LIMIT 5` preview (read-only). The browser shows which Connections are active or inactive.
_Avoid_: Schema explorer, object tree

**Query Editor**:
The SQL editor within a Query tab. Provides syntax highlighting and autocomplete for SQL keywords, PostgreSQL functions, and table/column names from the active schema.
_Avoid_: Code editor, text editor

**Result Grid**:
The table view displaying query results. Uses pagination with next/prev buttons. SELECT results are editable — changes are applied via an explicit "Apply" button. The backend auto-paginates using LIMIT/OFFSET.
_Avoid_: Data grid, result set

**Color Label**:
A colored tag applied to saved Queries for organization. Uses a set of predefined colors plus a custom color picker.
_Avoid_: Tag, category

## Example dialogue

> **Dev**: "O usuário clicou numa tabela no Table Browser, abriu o preview. Agora ele quer filtrar — como faz?"
>
> **Domain expert**: "Ele abre uma nova Query tab, seleciona a Connection ativa, e escreve o SELECT com WHERE. O autocomplete ajuda com o nome das colunas."
>
> **Dev**: "E se ele editar o resultado do SELECT direto na Result Grid?"
>
> **Domain expert**: "Ele edita a célula, e clica Apply pra persistir. Mas se foi pelo preview do Table Browser (LIMIT 5), é read-only."
>
> **Dev**: "Uma query tá demorando muito. Ele pode cancelar?"
>
> **Domain expert**: "Sim, botão Stop no editor. A Connection fica ativa, só a query é cancelada."
