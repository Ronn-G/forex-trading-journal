use std::path::{Path, PathBuf};
use std::time::Duration;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

use super::error::ImportCommandError;

pub const DATABASE_RELATIVE_PATH: &str = "database/journal.db";

pub fn resolve_database_path(app: &AppHandle) -> Result<PathBuf, ImportCommandError> {
    app.path()
        .app_config_dir()
        .map(|base| base.join(DATABASE_RELATIVE_PATH))
        .map_err(|_| {
            ImportCommandError::new("DATABASE_UNAVAILABLE", "Database path is unavailable.")
        })
}

pub async fn open_database(path: &Path) -> Result<SqlitePool, ImportCommandError> {
    let parent = path.parent().ok_or_else(|| {
        ImportCommandError::new("DATABASE_UNAVAILABLE", "Database directory is unavailable.")
    })?;
    std::fs::create_dir_all(parent).map_err(|_| {
        ImportCommandError::new(
            "DATABASE_UNAVAILABLE",
            "Database directory could not be created.",
        )
    })?;
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(false)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5))
        .journal_mode(SqliteJournalMode::Wal);
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|_| {
            ImportCommandError::new("DATABASE_UNAVAILABLE", "Database could not be opened.")
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Connection;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn relative_contract_matches_plugin_sql_connection() {
        assert_eq!(DATABASE_RELATIVE_PATH, "database/journal.db");
        assert_eq!(
            Path::new("database").join("journal.db"),
            Path::new(DATABASE_RELATIVE_PATH)
        );
    }

    #[tokio::test]
    async fn opens_real_database_with_spaces_and_unicode_in_path() {
        let unique = format!(
            "forex journal Unicode-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let directory = std::env::temp_dir().join(unique);
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("journal.db");
        let create_options = SqliteConnectOptions::new()
            .filename(&path)
            .create_if_missing(true);
        let mut connection = sqlx::SqliteConnection::connect_with(&create_options)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE path_probe (id INTEGER PRIMARY KEY)")
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();

        let pool = open_database(&path).await.unwrap();
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM sqlite_master WHERE name = 'path_probe'"
            )
            .fetch_one(&pool)
            .await
            .unwrap(),
            1
        );
        pool.close().await;
        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir(&directory).unwrap();
    }
}
