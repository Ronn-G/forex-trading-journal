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
    use sqlx::{Connection, Row};
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

    async fn apply_migrations(pool: &SqlitePool, through: usize) {
        let migrations = [
            include_str!("../../../src/infrastructure/database/migrations/0001_initial.sql"),
            include_str!("../../../src/infrastructure/database/migrations/0002_accounts.sql"),
            include_str!(
                "../../../src/infrastructure/database/migrations/0003_import_foundation.sql"
            ),
            include_str!("../../../src/infrastructure/database/migrations/0004_mt5_entities.sql"),
            include_str!("../../../src/infrastructure/database/migrations/0005_trades.sql"),
        ];
        for (index, sql) in migrations.iter().take(through).enumerate() {
            sqlx::raw_sql(sql).execute(pool).await.unwrap();
            sqlx::query(
                "INSERT INTO schema_migrations(version,name,checksum,applied_at)
                 VALUES($1,$2,$3,1)",
            )
            .bind((index + 1) as i64)
            .bind(format!("000{}", index + 1))
            .bind(format!("synthetic-checksum-{}", index + 1))
            .execute(pool)
            .await
            .unwrap();
        }
    }

    async fn insert_raw(
        pool: &SqlitePool,
        id: &str,
        batch: &str,
        account: &str,
        record_type: &str,
        external_id: &str,
        row: i64,
    ) {
        sqlx::query(
            "INSERT INTO raw_mt5_records(
              id,import_batch_id,account_id,record_type,external_id,row_number,raw_json,created_at
            ) VALUES($1,$2,$3,$4,$5,$6,'{}',1)",
        )
        .bind(id)
        .bind(batch)
        .bind(account)
        .bind(record_type)
        .bind(external_id)
        .bind(row)
        .execute(pool)
        .await
        .unwrap();
    }

    struct PositionSeed<'a> {
        id: &'a str,
        account: &'a str,
        batch: &'a str,
        raw: &'a str,
        external_id: &'a str,
        side: &'a str,
        status: &'a str,
        close_price: Option<&'a str>,
        closed_at: Option<i64>,
    }

    async fn insert_position(
        pool: &SqlitePool,
        values: PositionSeed<'_>,
    ) -> Result<sqlx::sqlite::SqliteQueryResult, sqlx::Error> {
        sqlx::query(
            "INSERT INTO mt5_positions(
              id,account_id,import_batch_id,raw_record_id,external_position_id,symbol,side,volume,
              open_price,opened_at,original_opened_at,close_price,closed_at,original_closed_at,
              commission,swap,profit,status,created_at
            ) VALUES($1,$2,$3,$4,$5,'EURUSD',$6,'0.1','1.1',10,'open',$8,$9,
              CASE WHEN $9 IS NULL THEN NULL ELSE 'close' END,'0','0','1',$7,1)",
        )
        .bind(values.id)
        .bind(values.account)
        .bind(values.batch)
        .bind(values.raw)
        .bind(values.external_id)
        .bind(values.side)
        .bind(values.status)
        .bind(values.close_price)
        .bind(values.closed_at)
        .execute(pool)
        .await
    }

    fn assert_check_failure(
        result: Result<sqlx::sqlite::SqliteQueryResult, sqlx::Error>,
        invariant: &str,
    ) {
        let error = result.unwrap_err();
        assert!(
            error.to_string().contains("CHECK constraint failed"),
            "{invariant} failed for an unexpected reason: {error}"
        );
    }

    fn assert_foreign_key_failure(
        result: Result<sqlx::sqlite::SqliteQueryResult, sqlx::Error>,
        invariant: &str,
    ) {
        let error = result.unwrap_err();
        assert!(
            error.to_string().contains("FOREIGN KEY constraint failed"),
            "{invariant} failed for an unexpected reason: {error}"
        );
    }

    fn assert_unique_failure(
        result: Result<sqlx::sqlite::SqliteQueryResult, sqlx::Error>,
        invariant: &str,
    ) {
        let error = result.unwrap_err();
        assert!(
            error.to_string().contains("UNIQUE constraint failed"),
            "{invariant} failed for an unexpected reason: {error}"
        );
    }

    #[tokio::test]
    async fn real_sqlite_migration_sql_enforces_schema_constraints_and_indexes() {
        let path = std::env::temp_dir().join(format!(
            "forex-migrations-{}-{}.db",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let options = SqliteConnectOptions::new()
            .filename(&path)
            .create_if_missing(true)
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .unwrap();
        apply_migrations(&pool, 5).await;

        assert_eq!(
            sqlx::query_scalar::<_, i64>("PRAGMA foreign_keys")
                .fetch_one(&pool)
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM schema_migrations")
                .fetch_one(&pool)
                .await
                .unwrap(),
            5
        );
        for table in [
            "accounts",
            "import_batches",
            "raw_mt5_records",
            "mt5_positions",
            "mt5_orders",
            "mt5_deals",
            "trades",
        ] {
            assert_eq!(
                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=$1"
                )
                .bind(table)
                .fetch_one(&pool)
                .await
                .unwrap(),
                1,
                "missing table {table}"
            );
        }
        for index in [
            "idx_accounts_archived_name",
            "idx_import_batches_account_started",
            "idx_raw_mt5_records_batch",
            "idx_mt5_positions_batch",
            "idx_mt5_orders_batch",
            "idx_mt5_deals_batch",
            "idx_trades_account_closed",
        ] {
            assert_eq!(
                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=$1"
                )
                .bind(index)
                .fetch_one(&pool)
                .await
                .unwrap(),
                1,
                "missing index {index}"
            );
        }

        let account = "INSERT INTO accounts(id,name,broker,server,login_masked,account_currency,\
          account_type,timezone,is_demo,is_archived,created_at,updated_at)\
          VALUES($1,'Synthetic','Broker','Server','***0001','USD','Hedge','UTC',$2,0,1,1)";
        sqlx::query(account)
            .bind("a")
            .bind(0)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(account)
            .bind("b")
            .bind(0)
            .execute(&pool)
            .await
            .unwrap();
        assert!(sqlx::query(account)
            .bind("bad")
            .bind(2)
            .execute(&pool)
            .await
            .is_err());
        let invalid_archived = account.replace(",$2,0,1,1)", ",0,$2,1,1)");
        assert!(sqlx::query(&invalid_archived)
            .bind("bad-archived")
            .bind(2)
            .execute(&pool)
            .await
            .is_err());
        assert!(sqlx::query(
            "INSERT INTO import_batches(id,account_id,source_type,source_filename,source_sha256,\
             parser_version,status,total_rows,imported_rows,skipped_rows,warning_rows,error_rows,started_at)\
             VALUES('bad-fk','missing','CSV','x','h','v','IMPORTED',0,0,0,0,0,1)"
        ).execute(&pool).await.is_err());
        for (id, account_id) in [("batch-a", "a"), ("batch-b", "b")] {
            sqlx::query(
                "INSERT INTO import_batches(id,account_id,source_type,source_filename,source_sha256,\
                 parser_version,status,total_rows,imported_rows,skipped_rows,warning_rows,error_rows,started_at)\
                 VALUES($1,$2,'CSV','x','same-hash','v','IMPORTED',1,1,0,0,0,1)"
            ).bind(id).bind(account_id).execute(&pool).await.unwrap();
        }
        assert!(sqlx::query(
            "INSERT INTO import_batches(id,account_id,source_type,source_filename,source_sha256,\
             parser_version,status,total_rows,imported_rows,skipped_rows,warning_rows,error_rows,started_at)\
             VALUES('dup','a','CSV','x','same-hash','v','IMPORTED',0,0,0,0,0,1)"
        ).execute(&pool).await.is_err());

        insert_raw(&pool, "rp-a", "batch-a", "a", "POSITION", "p1", 1).await;
        insert_raw(&pool, "rp-b", "batch-b", "b", "POSITION", "p1", 1).await;
        insert_raw(&pool, "ro-a", "batch-a", "a", "ORDER", "o1", 2).await;
        insert_raw(&pool, "ro-b", "batch-b", "b", "ORDER", "o1", 2).await;
        insert_raw(&pool, "rd-a", "batch-a", "a", "DEAL", "d1", 3).await;
        insert_raw(&pool, "rd-b", "batch-b", "b", "DEAL", "d1", 3).await;

        insert_position(
            &pool,
            PositionSeed {
                id: "pa",
                account: "a",
                batch: "batch-a",
                raw: "rp-a",
                external_id: "p1",
                side: "BUY",
                status: "CLOSED",
                close_price: Some("1.2"),
                closed_at: Some(20),
            },
        )
        .await
        .unwrap();
        insert_position(
            &pool,
            PositionSeed {
                id: "pb",
                account: "b",
                batch: "batch-b",
                raw: "rp-b",
                external_id: "p1",
                side: "SELL",
                status: "CLOSED",
                close_price: Some("1.2"),
                closed_at: Some(20),
            },
        )
        .await
        .unwrap();
        assert_unique_failure(
            insert_position(
                &pool,
                PositionSeed {
                    id: "pa2",
                    account: "a",
                    batch: "batch-a",
                    raw: "rp-a",
                    external_id: "p1",
                    side: "BUY",
                    status: "CLOSED",
                    close_price: Some("1.2"),
                    closed_at: Some(20),
                },
            )
            .await,
            "position external ID uniqueness",
        );
        assert_check_failure(
            insert_position(
                &pool,
                PositionSeed {
                    id: "ps",
                    account: "a",
                    batch: "batch-a",
                    raw: "rp-a",
                    external_id: "ps",
                    side: "HOLD",
                    status: "OPEN",
                    close_price: None,
                    closed_at: None,
                },
            )
            .await,
            "position side CHECK",
        );
        assert_check_failure(
            insert_position(
                &pool,
                PositionSeed {
                    id: "pst",
                    account: "a",
                    batch: "batch-a",
                    raw: "rp-a",
                    external_id: "pst",
                    side: "BUY",
                    status: "BROKEN",
                    close_price: None,
                    closed_at: None,
                },
            )
            .await,
            "position status CHECK",
        );
        assert_check_failure(
            insert_position(
                &pool,
                PositionSeed {
                    id: "pcp",
                    account: "a",
                    batch: "batch-a",
                    raw: "rp-a",
                    external_id: "pcp",
                    side: "BUY",
                    status: "CLOSED",
                    close_price: None,
                    closed_at: Some(20),
                },
            )
            .await,
            "closed position close_price CHECK",
        );
        assert_check_failure(
            insert_position(
                &pool,
                PositionSeed {
                    id: "pct",
                    account: "a",
                    batch: "batch-a",
                    raw: "rp-a",
                    external_id: "pct",
                    side: "BUY",
                    status: "CLOSED",
                    close_price: Some("1.2"),
                    closed_at: None,
                },
            )
            .await,
            "closed position closed_at CHECK",
        );

        let order_sql = "INSERT INTO mt5_orders(
          id,account_id,import_batch_id,raw_record_id,external_order_id,symbol,order_type,
          volume_initial,placed_at,original_placed_at,created_at
        ) VALUES($1,$2,$3,$4,'o1','EURUSD','buy','0.1',10,'placed',1)";
        for values in [
            ("oa", "a", "batch-a", "ro-a"),
            ("ob", "b", "batch-b", "ro-b"),
        ] {
            sqlx::query(order_sql)
                .bind(values.0)
                .bind(values.1)
                .bind(values.2)
                .bind(values.3)
                .execute(&pool)
                .await
                .unwrap();
        }
        assert_unique_failure(
            sqlx::query(order_sql)
                .bind("oa2")
                .bind("a")
                .bind("batch-a")
                .bind("ro-a")
                .execute(&pool)
                .await,
            "order external ID uniqueness",
        );

        let deal_sql = "INSERT INTO mt5_deals(
          id,account_id,import_batch_id,raw_record_id,external_deal_id,symbol,side,entry_type,
          volume,price,executed_at,original_executed_at,created_at
        ) VALUES($1,$2,$3,$4,'d1','EURUSD','BUY','in','0.1','1.1',10,'executed',1)";
        for values in [
            ("da", "a", "batch-a", "rd-a"),
            ("db", "b", "batch-b", "rd-b"),
        ] {
            sqlx::query(deal_sql)
                .bind(values.0)
                .bind(values.1)
                .bind(values.2)
                .bind(values.3)
                .execute(&pool)
                .await
                .unwrap();
        }
        assert_unique_failure(
            sqlx::query(deal_sql)
                .bind("da2")
                .bind("a")
                .bind("batch-a")
                .bind("rd-a")
                .execute(&pool)
                .await,
            "deal external ID uniqueness",
        );

        let trade_sql = "INSERT INTO trades(
          id,account_id,source_type,source_position_id,import_batch_id,symbol,side,volume,
          opened_at,closed_at,original_opened_at,original_closed_at,open_price,close_price,
          commission,swap,gross_profit,net_profit,duration_ms,status,created_at,updated_at
        ) VALUES($1,$2,$3,$4,$5,'EURUSD',$6,'0.1',10,$7,'open','close','1.1','1.2',
          '0','0','1','1',$8,$9,1,1)";
        sqlx::query(trade_sql)
            .bind("ta")
            .bind("a")
            .bind("MT5_POSITION")
            .bind("p1")
            .bind("batch-a")
            .bind("BUY")
            .bind(20_i64)
            .bind(10_i64)
            .bind("CLOSED")
            .execute(&pool)
            .await
            .unwrap();
        assert_unique_failure(
            sqlx::query(trade_sql)
                .bind("ta2")
                .bind("a")
                .bind("MT5_POSITION")
                .bind("p1")
                .bind("batch-a")
                .bind("BUY")
                .bind(20_i64)
                .bind(10_i64)
                .bind("CLOSED")
                .execute(&pool)
                .await,
            "trade source identity uniqueness",
        );
        let trade_cases = [
            (
                "tsrc",
                "OTHER",
                "BUY",
                20_i64,
                10_i64,
                "CLOSED",
                "trade source_type CHECK",
            ),
            (
                "tside",
                "MT5_POSITION",
                "HOLD",
                20,
                10,
                "CLOSED",
                "trade side CHECK",
            ),
            (
                "tstatus",
                "MT5_POSITION",
                "BUY",
                20,
                10,
                "OPEN",
                "trade status CHECK",
            ),
            (
                "tduration",
                "MT5_POSITION",
                "BUY",
                20,
                -1,
                "CLOSED",
                "trade duration CHECK",
            ),
            (
                "ttime",
                "MT5_POSITION",
                "BUY",
                5,
                0,
                "CLOSED",
                "trade timestamp CHECK",
            ),
        ];
        for (row, (id, _, _, _, _, _, _)) in trade_cases.iter().enumerate() {
            let raw_id = format!("raw-{id}");
            let position_id = format!("position-{id}");
            insert_raw(
                &pool,
                &raw_id,
                "batch-a",
                "a",
                "POSITION",
                id,
                10 + row as i64,
            )
            .await;
            insert_position(
                &pool,
                PositionSeed {
                    id: &position_id,
                    account: "a",
                    batch: "batch-a",
                    raw: &raw_id,
                    external_id: id,
                    side: "BUY",
                    status: "CLOSED",
                    close_price: Some("1.2"),
                    closed_at: Some(20),
                },
            )
            .await
            .unwrap();
        }
        for (id, source, side, closed, duration, status, invariant) in trade_cases {
            assert_check_failure(
                sqlx::query(trade_sql)
                    .bind(id)
                    .bind("a")
                    .bind(source)
                    .bind(id)
                    .bind("batch-a")
                    .bind(side)
                    .bind(closed)
                    .bind(duration)
                    .bind(status)
                    .execute(&pool)
                    .await,
                invariant,
            );
        }
        for (id, account_id, source_id, batch_id, invariant) in [
            (
                "tfk-account",
                "missing",
                "tsrc",
                "batch-a",
                "trade account FK",
            ),
            (
                "tfk-batch",
                "a",
                "tside",
                "missing",
                "trade import batch FK",
            ),
        ] {
            assert_foreign_key_failure(
                sqlx::query(trade_sql)
                    .bind(id)
                    .bind(account_id)
                    .bind("MT5_POSITION")
                    .bind(source_id)
                    .bind(batch_id)
                    .bind("BUY")
                    .bind(20_i64)
                    .bind(10_i64)
                    .bind("CLOSED")
                    .execute(&pool)
                    .await,
                invariant,
            );
        }

        let columns = sqlx::query("PRAGMA table_info(trades)")
            .fetch_all(&pool)
            .await
            .unwrap();
        for name in [
            "volume",
            "open_price",
            "close_price",
            "commission",
            "swap",
            "gross_profit",
            "net_profit",
        ] {
            assert!(
                columns
                    .iter()
                    .any(|row| row.get::<String, _>("name") == name
                        && row.get::<String, _>("type") == "TEXT"),
                "{name} is not TEXT"
            );
        }
        for (table, names) in [
            (
                "mt5_positions",
                &[
                    "volume",
                    "open_price",
                    "close_price",
                    "commission",
                    "swap",
                    "profit",
                ][..],
            ),
            (
                "mt5_orders",
                &["volume_initial", "volume_current", "open_price"][..],
            ),
            (
                "mt5_deals",
                &["volume", "price", "commission", "swap", "profit"][..],
            ),
        ] {
            let table_columns = sqlx::query(&format!("PRAGMA table_info({table})"))
                .fetch_all(&pool)
                .await
                .unwrap();
            for name in names {
                assert!(
                    table_columns
                        .iter()
                        .any(|row| row.get::<String, _>("name") == *name
                            && row.get::<String, _>("type") == "TEXT"),
                    "{table}.{name} is not TEXT"
                );
            }
        }

        pool.close().await;
        std::fs::remove_file(path).unwrap();
    }
}
