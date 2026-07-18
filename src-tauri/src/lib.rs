// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

#[tauri::command]
fn get_app_paths(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "app_data_dir": app_data_dir.to_string_lossy(),
        "database_dir": app_data_dir.join("database").to_string_lossy(),
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
                let err_msg = format!("Failed to get app data directory: {:?}", e);
                eprintln!("{}", err_msg);
                tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, err_msg))
            })?;
            
            // Tạo các thư mục con trong App Data
            let subdirs = ["database", "images/trades", "backups", "imports", "logs"];
            for subdir in &subdirs {
                let path = app_data_dir.join(subdir);
                if !path.exists() {
                    std::fs::create_dir_all(&path).map_err(|e| {
                        let err_msg = format!("Failed to create directory {:?}: {:?}", path, e);
                        eprintln!("{}", err_msg);
                        tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, err_msg))
                    })?;
                }
            }

            // Đảm bảo thư mục database cũng tồn tại trong App Config (nơi tauri-plugin-sql giải quyết đường dẫn)
            if let Ok(app_config_dir) = app.path().app_config_dir() {
                let config_db_dir = app_config_dir.join("database");
                if !config_db_dir.exists() {
                    std::fs::create_dir_all(&config_db_dir).map_err(|e| {
                        let err_msg = format!("Failed to create config database directory {:?}: {:?}", config_db_dir, e);
                        eprintln!("{}", err_msg);
                        tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, err_msg))
                    })?;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_app_paths])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
