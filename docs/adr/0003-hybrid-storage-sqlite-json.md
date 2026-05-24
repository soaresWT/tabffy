# Hybrid local storage: SQLite + JSON

App state is split across two storage backends. SQLite stores relational data (saved Queries, Connection definitions, query metadata) via SQLx. JSON files store configuration and preferences. This avoids over-engineering config into a relational schema while keeping structured queryable data in a proper database.
