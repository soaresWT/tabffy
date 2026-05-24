mod commands;
mod db;
mod models;
mod state;
mod storage;

use state::AppState;
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let pool = tauri::async_runtime::block_on(storage::init_pool(&data_dir))
                .expect("failed to initialize storage");

            app.manage(AppState::new(pool));

            let sep1 = PredefinedMenuItem::separator(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let sep3 = PredefinedMenuItem::separator(app)?;
            let sep4 = PredefinedMenuItem::separator(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&MenuItem::with_id(app, "new_tab", "New Tab", true, Some("CmdOrCtrl+N"))?)
                .item(&MenuItem::with_id(app, "close_tab", "Close Tab", true, Some("CmdOrCtrl+W"))?)
                .item(&sep1)
                .item(&MenuItem::with_id(app, "save_query", "Save Query", true, Some("CmdOrCtrl+S"))?)
                .item(&sep2)
                .item(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&MenuItem::with_id(app, "find", "Find", true, Some("CmdOrCtrl+F"))?)
                .item(&MenuItem::with_id(app, "replace", "Replace", true, Some("CmdOrCtrl+H"))?)
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&MenuItem::with_id(app, "toggle_sidebar", "Toggle Sidebar", true, None::<&str>)?)
                .item(&MenuItem::with_id(app, "toggle_results", "Toggle Results Panel", true, None::<&str>)?)
                .item(&sep3)
                .item(&MenuItem::with_id(app, "zoom_in", "Zoom In", true, Some("CmdOrCtrl+="))?)
                .item(&MenuItem::with_id(app, "zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-"))?)
                .item(&MenuItem::with_id(app, "zoom_reset", "Reset Zoom", true, Some("CmdOrCtrl+0"))?)
                .item(&sep4)
                .item(&MenuItem::with_id(app, "format_sql", "Format SQL", true, None::<&str>)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                let id = event.id().as_ref();
                match id {
                    "quit" => app_handle.exit(0),
                    other => {
                        let _ = app_handle.emit("menu-event", other.to_string());
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connection::test_connection,
            commands::connection::save_connection,
            commands::connection::list_connections,
            commands::connection::delete_connection,
            commands::connection::update_connection,
            commands::connection::activate_connection,
            commands::connection::deactivate_connection,
            commands::connection::is_connection_active,
            commands::connection::list_schemas,
            commands::connection::list_tables,
            commands::connection::list_columns,
            commands::connection::execute_query,
            commands::connection::cancel_query,
            commands::connection::ping_connection,
            commands::connection::reconnect_connection,
            commands::query::save_query,
            commands::query::update_query,
            commands::query::list_saved_queries,
            commands::query::delete_query,
            commands::history::add_query_history,
            commands::history::list_query_history,
            commands::history::clear_query_history,
            commands::tabs::save_open_tabs,
            commands::tabs::load_open_tabs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
