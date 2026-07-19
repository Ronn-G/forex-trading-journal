// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
mod import;

#[tauri::command]
fn get_app_paths(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let app_config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "app_data_dir": app_data_dir.to_string_lossy(),
        "database_dir": app_config_dir.join("database").to_string_lossy(),
        "images_dir": app_data_dir.join("images").to_string_lossy(),
        "backups_dir": app_data_dir.join("backups").to_string_lossy(),
        "imports_dir": app_data_dir.join("imports").to_string_lossy(),
        "logs_dir": app_data_dir.join("logs").to_string_lossy(),
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().map_err(|e| {
                let _ = e;
                eprintln!("APP_DATA_DIRECTORY_UNAVAILABLE");
                tauri::Error::Io(std::io::Error::other("App data directory is unavailable."))
            })?;

            // Create the required subdirectories in App Data.
            let subdirs = ["database", "images/trades", "backups", "imports", "logs"];
            for subdir in &subdirs {
                let path = app_data_dir.join(subdir);
                if !path.exists() {
                    std::fs::create_dir_all(&path).map_err(|e| {
                        let _ = e;
                        eprintln!("APP_DATA_SUBDIRECTORY_CREATE_FAILED");
                        tauri::Error::Io(std::io::Error::other(
                            "An application data directory could not be created.",
                        ))
                    })?;
                }
            }

            // tauri-plugin-sql resolves its relative SQLite path under App Config.
            if let Ok(app_config_dir) = app.path().app_config_dir() {
                let config_db_dir = app_config_dir.join("database");
                if !config_db_dir.exists() {
                    std::fs::create_dir_all(&config_db_dir).map_err(|e| {
                        let _ = e;
                        eprintln!("DATABASE_DIRECTORY_CREATE_FAILED");
                        tauri::Error::Io(std::io::Error::other(
                            "The database directory could not be created.",
                        ))
                    })?;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_paths,
            import::command::commit_mt5_import,
            import::command::backfill_missing_trades
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
