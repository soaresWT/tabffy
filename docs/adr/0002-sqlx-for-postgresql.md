# SQLx for PostgreSQL connectivity

We chose SQLx as the database driver because it provides compile-time query checking, async support (critical for handling multiple simultaneous connections and long-running queries with cancellation), and native PostgreSQL protocol support. Alternatives like diesel are synchronous and ORM-heavy, which doesn't fit a tool where users write raw SQL.
