# Tauri as desktop framework

We chose Tauri over Electron because Tabffy needs native PostgreSQL connectivity (via SQLx) on the backend, which maps naturally to Tauri's Rust sidecar. Tauri also produces significantly smaller binaries and lower memory usage than Electron, which matters for a developer tool that stays open all day.
