use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};

use rust_decimal::Decimal;
use sqlx::{Row, Sqlite, Transaction};
use tauri::AppHandle;

use super::database::{open_database, resolve_database_path};
use super::error::ImportCommandError;
use super::models::*;

const SOURCE_TYPE: &str = "VANTAGE_MT5_TRADE_HISTORY_CSV";
const PARSER_VERSION: &str = "vantage-mt5-trade-history-csv@1";
const MAX_RECORDS: usize = 100_000;
const MAX_SOURCE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_RAW_JSON_BYTES: usize = 32 * 1024 * 1024;
const MAX_RAW_JSON_RECORD_BYTES: usize = 1024 * 1024;
const MAX_FILENAME_BYTES: usize = 255;
const MAX_ID_BYTES: usize = 255;
const MAX_SYMBOL_BYTES: usize = 64;
const MAX_COMMENT_BYTES: usize = 4 * 1024;

struct RawLookup<'a> {
    id: &'a str,
    record_type: &'a str,
    external_id: Option<&'a str>,
}

struct PositionForNormalization<'a> {
    trade_id: String,
    account_id: &'a str,
    import_batch_id: &'a str,
    source_position_id: &'a str,
    symbol: &'a str,
    side: &'a str,
    volume: &'a str,
    opened_at: i64,
    closed_at: i64,
    original_opened_at: &'a str,
    original_closed_at: &'a str,
    open_price: &'a str,
    close_price: &'a str,
    stop_loss: Option<&'a str>,
    take_profit: Option<&'a str>,
    commission: &'a str,
    swap: &'a str,
    profit: &'a str,
    timestamp: i64,
}

fn checked_net_profit(
    profit: &str,
    commission: &str,
    swap: &str,
) -> Result<String, ImportCommandError> {
    let profit = profit
        .parse::<Decimal>()
        .map_err(|_| validation("Position financial values are invalid."))?;
    let commission = commission
        .parse::<Decimal>()
        .map_err(|_| validation("Position financial values are invalid."))?;
    let swap = swap
        .parse::<Decimal>()
        .map_err(|_| validation("Position financial values are invalid."))?;
    profit
        .checked_add(commission)
        .and_then(|value| value.checked_add(swap))
        .map(|value| value.normalize().to_string())
        .ok_or_else(|| validation("Position financial total is out of range."))
}

async fn insert_normalized_trade(
    tx: &mut Transaction<'_, Sqlite>,
    position: PositionForNormalization<'_>,
) -> Result<(), ImportCommandError> {
    if position.closed_at < position.opened_at {
        return Err(validation("Position close time precedes open time."));
    }
    let net_profit = checked_net_profit(position.profit, position.commission, position.swap)?;
    let inserted = sqlx::query(
        "INSERT INTO trades (
          id, account_id, source_type, source_position_id, import_batch_id,
          symbol, side, volume, opened_at, closed_at, original_opened_at,
          original_closed_at, open_price, close_price, stop_loss, take_profit,
          commission, swap, gross_profit, net_profit, duration_ms, status,
          created_at, updated_at
        ) VALUES (
          $1,$2,'MT5_POSITION',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,'CLOSED',$21,$21
        )",
    )
    .bind(position.trade_id)
    .bind(position.account_id)
    .bind(position.source_position_id)
    .bind(position.import_batch_id)
    .bind(position.symbol)
    .bind(position.side)
    .bind(position.volume)
    .bind(position.opened_at)
    .bind(position.closed_at)
    .bind(position.original_opened_at)
    .bind(position.original_closed_at)
    .bind(position.open_price)
    .bind(position.close_price)
    .bind(position.stop_loss)
    .bind(position.take_profit)
    .bind(position.commission)
    .bind(position.swap)
    .bind(position.profit)
    .bind(net_profit)
    .bind(position.closed_at - position.opened_at)
    .bind(position.timestamp)
    .execute(&mut **tx)
    .await;
    if inserted.is_err() {
        if conflict_exists(
            tx,
            "trades",
            "source_position_id",
            position.account_id,
            &[position.source_position_id.to_owned()],
        )
        .await
        .unwrap_or(false)
        {
            return Err(ImportCommandError::new(
                "ENTITY_CONFLICT",
                "A normalized trade already exists for this position.",
            ));
        }
        return Err(ImportCommandError::new(
            "TRANSACTION_FAILED",
            "Normalized trades could not be inserted.",
        ));
    }
    Ok(())
}

#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FailurePoint {
    AfterBatch,
    AfterRaw,
    AfterPosition,
    AfterOrder,
    AfterDeal,
    AfterTrades,
    BeforeFinalUpdate,
}

#[cfg(test)]
fn inject_failure(
    configured: Option<FailurePoint>,
    current: FailurePoint,
) -> Result<(), ImportCommandError> {
    if configured == Some(current) {
        Err(ImportCommandError::new(
            "TRANSACTION_FAILED",
            "Injected test transaction failure.",
        ))
    } else {
        Ok(())
    }
}

fn validation(message: impl Into<String>) -> ImportCommandError {
    ImportCommandError::new("VALIDATION_ERROR", message)
}

fn is_decimal(value: &str) -> bool {
    let value = value.strip_prefix('-').unwrap_or(value);
    let mut parts = value.split('.');
    let integer = parts.next().unwrap_or_default();
    let fraction = parts.next();
    !integer.is_empty()
        && integer.chars().all(|c| c.is_ascii_digit())
        && fraction.is_none_or(|v| !v.is_empty() && v.chars().all(|c| c.is_ascii_digit()))
        && parts.next().is_none()
}

fn valid_optional_decimal(value: Option<&String>) -> bool {
    value.is_none_or(|value| is_decimal(value))
}

fn nonempty(value: &str) -> bool {
    !value.trim().is_empty()
}

fn valid_length(value: &str, max: usize) -> bool {
    nonempty(value) && value.len() <= max
}

fn valid_optional_length(value: Option<&String>, max: usize) -> bool {
    value.is_none_or(|value| value.len() <= max)
}

fn unique_nonempty<'a>(
    values: impl Iterator<Item = &'a str>,
    label: &str,
) -> Result<(), ImportCommandError> {
    let mut seen = HashSet::new();
    for value in values {
        if !nonempty(value) {
            return Err(validation(format!("{label} is required.")));
        }
        if !seen.insert(value) {
            return Err(validation(format!("Duplicate {label} in payload.")));
        }
    }
    Ok(())
}

fn validate_payload(
    payload: &CommitImportPayload,
) -> Result<HashMap<&str, RawLookup<'_>>, ImportCommandError> {
    if !valid_length(&payload.account_id, MAX_ID_BYTES)
        || !valid_length(&payload.batch_id, MAX_ID_BYTES)
    {
        return Err(validation("Account and batch IDs are required."));
    }
    if !nonempty(&payload.source.filename) || payload.source.filename.len() > MAX_FILENAME_BYTES {
        return Err(validation("Source filename is invalid."));
    }
    if payload.source.source_type != SOURCE_TYPE || payload.source.parser_version != PARSER_VERSION
    {
        return Err(validation("Unsupported source type or parser version."));
    }
    if payload.started_at < 0
        || payload.source.size_bytes == 0
        || payload.source.size_bytes > MAX_SOURCE_BYTES
        || payload.raw_records.len()
            + payload.positions.len()
            + payload.orders.len()
            + payload.deals.len()
            > MAX_RECORDS
    {
        return Err(validation("Import payload exceeds configured limits."));
    }
    if payload.source.sha256.len() != 64
        || !payload.source.sha256.chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err(validation("Source SHA-256 is invalid."));
    }
    if payload.counts.total_rows < 0
        || payload.counts.skipped_rows < 0
        || payload.counts.warning_rows < 0
        || payload.counts.error_rows < 0
    {
        return Err(validation("Import counts cannot be negative."));
    }
    let importable = (payload.positions.len() + payload.orders.len() + payload.deals.len()) as i64;
    if payload.counts.total_rows < importable + payload.counts.skipped_rows
        || payload.raw_records.len() as i64 > payload.counts.total_rows
        || payload.counts.total_rows as usize > MAX_RECORDS
        || payload.counts.skipped_rows as usize > MAX_RECORDS
        || payload.counts.warning_rows as usize > MAX_RECORDS
        || payload.counts.error_rows as usize > MAX_RECORDS
    {
        return Err(validation(
            "Import counts are inconsistent or exceed limits.",
        ));
    }
    if payload
        .raw_records
        .iter()
        .map(|r| r.raw_json.len())
        .sum::<usize>()
        > MAX_RAW_JSON_BYTES
    {
        return Err(validation("Raw record payload is too large."));
    }
    unique_nonempty(
        payload.raw_records.iter().map(|r| r.key.as_str()),
        "raw record key",
    )?;
    unique_nonempty(
        payload
            .raw_records
            .iter()
            .map(|r| r.id.as_str())
            .chain(payload.positions.iter().map(|r| r.id.as_str()))
            .chain(payload.orders.iter().map(|r| r.id.as_str()))
            .chain(payload.deals.iter().map(|r| r.id.as_str())),
        "payload row ID",
    )?;
    if payload
        .raw_records
        .iter()
        .map(|r| r.id.as_str())
        .chain(payload.positions.iter().map(|r| r.id.as_str()))
        .chain(payload.orders.iter().map(|r| r.id.as_str()))
        .chain(payload.deals.iter().map(|r| r.id.as_str()))
        .any(|value| value.len() > MAX_ID_BYTES)
    {
        return Err(validation("Payload row ID exceeds the length limit."));
    }
    unique_nonempty(
        payload
            .positions
            .iter()
            .map(|r| r.external_position_id.as_str()),
        "position ID",
    )?;
    unique_nonempty(
        payload.orders.iter().map(|r| r.external_order_id.as_str()),
        "order ID",
    )?;
    unique_nonempty(
        payload.deals.iter().map(|r| r.external_deal_id.as_str()),
        "deal ID",
    )?;

    let mut raw = HashMap::new();
    for record in &payload.raw_records {
        let valid_provenance = match record.record_type.as_str() {
            "POSITION" | "ORDER" | "DEAL" => record
                .external_id
                .as_deref()
                .is_some_and(|value| valid_length(value, MAX_ID_BYTES)),
            "RESULT" => record.external_id.is_none(),
            _ => false,
        };
        if !valid_length(&record.id, MAX_ID_BYTES)
            || !valid_length(&record.key, MAX_ID_BYTES)
            || !valid_provenance
            || record.row_number <= 0
            || record.raw_json.len() > MAX_RAW_JSON_RECORD_BYTES
            || serde_json::from_str::<serde_json::Value>(&record.raw_json).is_err()
        {
            return Err(validation(
                "Raw records must have valid row numbers and JSON.",
            ));
        }
        raw.insert(
            record.key.as_str(),
            RawLookup {
                id: record.id.as_str(),
                record_type: record.record_type.as_str(),
                external_id: record.external_id.as_deref(),
            },
        );
    }
    for position in &payload.positions {
        let provenance = raw.get(position.raw_key.as_str());
        if provenance.is_none_or(|raw| {
            raw.record_type != "POSITION"
                || raw.external_id != Some(position.external_position_id.as_str())
        }) || !valid_length(&position.external_position_id, MAX_ID_BYTES)
            || !valid_length(&position.symbol, MAX_SYMBOL_BYTES)
            || !matches!(position.side.as_str(), "BUY" | "SELL")
            || !matches!(position.status.as_str(), "OPEN" | "CLOSED")
            || !is_decimal(&position.volume)
            || !is_decimal(&position.open_price)
            || !valid_optional_decimal(position.stop_loss.as_ref())
            || !valid_optional_decimal(position.take_profit.as_ref())
            || !valid_optional_decimal(position.close_price.as_ref())
            || !is_decimal(&position.commission)
            || !is_decimal(&position.swap)
            || !is_decimal(&position.profit)
            || position.opened_at < 0
            || !nonempty(&position.original_opened_at)
        {
            return Err(validation("Position payload is invalid."));
        }
        match position.status.as_str() {
            "CLOSED"
                if position.close_price.is_none()
                    || position
                        .closed_at
                        .is_none_or(|closed| closed < position.opened_at)
                    || position
                        .original_closed_at
                        .as_deref()
                        .is_none_or(|value| !nonempty(value)) =>
            {
                return Err(validation("Closed positions require valid close fields."));
            }
            "OPEN"
                if position.close_price.is_some()
                    || position.closed_at.is_some()
                    || position.original_closed_at.is_some() =>
            {
                return Err(validation("Open positions cannot contain close fields."));
            }
            _ => {}
        }
    }
    for order in &payload.orders {
        let provenance = raw.get(order.raw_key.as_str());
        if provenance.is_none_or(|raw| {
            raw.record_type != "ORDER" || raw.external_id != Some(order.external_order_id.as_str())
        }) || !valid_length(&order.external_order_id, MAX_ID_BYTES)
            || !valid_length(&order.symbol, MAX_SYMBOL_BYTES)
            || !valid_length(&order.order_type, MAX_ID_BYTES)
            || !is_decimal(&order.volume_initial)
            || !valid_optional_decimal(order.volume_current.as_ref())
            || !valid_optional_decimal(order.open_price.as_ref())
            || !valid_optional_decimal(order.stop_loss.as_ref())
            || !valid_optional_decimal(order.take_profit.as_ref())
            || order.placed_at < 0
            || !nonempty(&order.original_placed_at)
            || order
                .closed_at
                .is_some_and(|closed| closed < order.placed_at)
            || !valid_optional_length(order.comment.as_ref(), MAX_COMMENT_BYTES)
        {
            return Err(validation("Order payload is invalid."));
        }
    }
    for deal in &payload.deals {
        let provenance = raw.get(deal.raw_key.as_str());
        if provenance.is_none_or(|raw| {
            raw.record_type != "DEAL" || raw.external_id != Some(deal.external_deal_id.as_str())
        }) || !valid_length(&deal.external_deal_id, MAX_ID_BYTES)
            || !valid_length(&deal.symbol, MAX_SYMBOL_BYTES)
            || !matches!(deal.side.as_str(), "BUY" | "SELL")
            || !nonempty(&deal.entry_type)
            || !is_decimal(&deal.volume)
            || !is_decimal(&deal.price)
            || !valid_optional_decimal(deal.commission.as_ref())
            || !valid_optional_decimal(deal.swap.as_ref())
            || !valid_optional_decimal(deal.profit.as_ref())
            || deal.executed_at < 0
            || !nonempty(&deal.original_executed_at)
            || !valid_optional_length(deal.comment.as_ref(), MAX_COMMENT_BYTES)
        {
            return Err(validation("Deal payload is invalid."));
        }
    }
    Ok(raw)
}

async fn conflict_exists(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    column: &str,
    account_id: &str,
    values: &[String],
) -> Result<bool, ImportCommandError> {
    for value in values {
        let sql = format!("SELECT 1 FROM {table} WHERE account_id = $1 AND {column} = $2 LIMIT 1");
        if sqlx::query(&sql)
            .bind(account_id)
            .bind(value)
            .fetch_optional(&mut **tx)
            .await
            .map_err(|_| {
                ImportCommandError::new("TRANSACTION_FAILED", "Import conflict check failed.")
            })?
            .is_some()
        {
            return Ok(true);
        }
    }
    Ok(false)
}

async fn raw_entity_conflict(
    tx: &mut Transaction<'_, Sqlite>,
    account_id: &str,
    raw: &RawRecordPayload,
) -> bool {
    if !matches!(raw.record_type.as_str(), "POSITION" | "ORDER" | "DEAL") {
        return false;
    }
    let Some(external_id) = raw.external_id.as_deref() else {
        return false;
    };
    sqlx::query(
        "SELECT 1 FROM raw_mt5_records
         WHERE account_id = $1 AND record_type = $2 AND external_id = $3 LIMIT 1",
    )
    .bind(account_id)
    .bind(&raw.record_type)
    .bind(external_id)
    .fetch_optional(&mut **tx)
    .await
    .is_ok_and(|row| row.is_some())
}

async fn commit_with_pool_internal(
    pool: &sqlx::SqlitePool,
    payload: CommitImportPayload,
    #[cfg(test)] failure_point: Option<FailurePoint>,
) -> Result<CommitImportResult, ImportCommandError> {
    let raw_ids = validate_payload(&payload)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(|_| {
        ImportCommandError::new("TRANSACTION_FAILED", "Import transaction could not start.")
    })?;

    let account = sqlx::query("SELECT is_archived FROM accounts WHERE id = $1")
        .bind(&payload.account_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| ImportCommandError::new("TRANSACTION_FAILED", "Account validation failed."))?;
    let account = account
        .ok_or_else(|| ImportCommandError::new("ACCOUNT_NOT_FOUND", "Account was not found."))?;
    if account.get::<i64, _>("is_archived") != 0 {
        return Err(ImportCommandError::new(
            "ACCOUNT_ARCHIVED",
            "Archived accounts cannot be imported.",
        ));
    }

    if let Some(row) = sqlx::query(
        "SELECT id FROM import_batches WHERE account_id = $1 AND source_sha256 = $2 LIMIT 1",
    )
    .bind(&payload.account_id)
    .bind(&payload.source.sha256)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| ImportCommandError::new("TRANSACTION_FAILED", "Duplicate check failed."))?
    {
        return Err(ImportCommandError::duplicate(row.get("id")));
    }

    if conflict_exists(
        &mut tx,
        "mt5_positions",
        "external_position_id",
        &payload.account_id,
        &payload
            .positions
            .iter()
            .map(|v| v.external_position_id.clone())
            .collect::<Vec<_>>(),
    )
    .await?
        || conflict_exists(
            &mut tx,
            "mt5_orders",
            "external_order_id",
            &payload.account_id,
            &payload
                .orders
                .iter()
                .map(|v| v.external_order_id.clone())
                .collect::<Vec<_>>(),
        )
        .await?
        || conflict_exists(
            &mut tx,
            "trades",
            "source_position_id",
            &payload.account_id,
            &payload
                .positions
                .iter()
                .filter(|value| value.status == "CLOSED")
                .map(|value| value.external_position_id.clone())
                .collect::<Vec<_>>(),
        )
        .await?
        || conflict_exists(
            &mut tx,
            "mt5_deals",
            "external_deal_id",
            &payload.account_id,
            &payload
                .deals
                .iter()
                .map(|v| v.external_deal_id.clone())
                .collect::<Vec<_>>(),
        )
        .await?
    {
        return Err(ImportCommandError::new(
            "ENTITY_CONFLICT",
            "Imported entity IDs already exist.",
        ));
    }

    let batch_insert = sqlx::query("INSERT INTO import_batches (id, account_id, source_type, source_filename, source_sha256, parser_version, status, total_rows, imported_rows, skipped_rows, warning_rows, error_rows, started_at) VALUES ($1,$2,$3,$4,$5,$6,'PENDING',0,0,0,0,0,$7)")
        .bind(&payload.batch_id).bind(&payload.account_id).bind(&payload.source.source_type)
        .bind(&payload.source.filename).bind(&payload.source.sha256).bind(&payload.source.parser_version)
        .bind(payload.started_at).execute(&mut *tx).await;
    if batch_insert.is_err() {
        if let Ok(Some(row)) = sqlx::query(
            "SELECT id FROM import_batches WHERE account_id = $1 AND source_sha256 = $2 LIMIT 1",
        )
        .bind(&payload.account_id)
        .bind(&payload.source.sha256)
        .fetch_optional(&mut *tx)
        .await
        {
            return Err(ImportCommandError::duplicate(row.get("id")));
        }
        return Err(ImportCommandError::new(
            "TRANSACTION_FAILED",
            "Import batch could not be created.",
        ));
    }
    #[cfg(test)]
    inject_failure(failure_point, FailurePoint::AfterBatch)?;

    for raw in &payload.raw_records {
        let inserted = sqlx::query("INSERT INTO raw_mt5_records (id, import_batch_id, account_id, record_type, external_id, row_number, raw_json, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
            .bind(&raw.id).bind(&payload.batch_id).bind(&payload.account_id).bind(&raw.record_type)
            .bind(&raw.external_id).bind(raw.row_number).bind(&raw.raw_json).bind(payload.started_at)
            .execute(&mut *tx).await;
        if inserted.is_err() {
            if raw_entity_conflict(&mut tx, &payload.account_id, raw).await {
                return Err(ImportCommandError::new(
                    "ENTITY_CONFLICT",
                    "Imported entity IDs already exist.",
                ));
            }
            return Err(ImportCommandError::new(
                "TRANSACTION_FAILED",
                "Raw records could not be inserted.",
            ));
        }
    }
    #[cfg(test)]
    inject_failure(failure_point, FailurePoint::AfterRaw)?;
    for p in &payload.positions {
        let inserted = sqlx::query("INSERT INTO mt5_positions (id,account_id,import_batch_id,raw_record_id,external_position_id,symbol,side,volume,open_price,stop_loss,take_profit,opened_at,original_opened_at,close_price,closed_at,original_closed_at,commission,swap,profit,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)")
            .bind(&p.id).bind(&payload.account_id).bind(&payload.batch_id).bind(raw_ids[p.raw_key.as_str()].id)
            .bind(&p.external_position_id).bind(&p.symbol).bind(&p.side).bind(&p.volume).bind(&p.open_price)
            .bind(&p.stop_loss).bind(&p.take_profit).bind(p.opened_at).bind(&p.original_opened_at)
            .bind(&p.close_price).bind(p.closed_at).bind(&p.original_closed_at).bind(&p.commission)
            .bind(&p.swap).bind(&p.profit).bind(&p.status).bind(payload.started_at)
            .execute(&mut *tx).await;
        if inserted.is_err() {
            if conflict_exists(
                &mut tx,
                "mt5_positions",
                "external_position_id",
                &payload.account_id,
                std::slice::from_ref(&p.external_position_id),
            )
            .await
            .unwrap_or(false)
            {
                return Err(ImportCommandError::new(
                    "ENTITY_CONFLICT",
                    "Imported entity IDs already exist.",
                ));
            }
            return Err(ImportCommandError::new(
                "TRANSACTION_FAILED",
                "Positions could not be inserted.",
            ));
        }
    }
    #[cfg(test)]
    inject_failure(failure_point, FailurePoint::AfterPosition)?;
    for o in &payload.orders {
        let inserted = sqlx::query("INSERT INTO mt5_orders (id,account_id,import_batch_id,raw_record_id,external_order_id,external_position_id,symbol,order_type,volume_initial,volume_current,open_price,stop_loss,take_profit,placed_at,original_placed_at,closed_at,original_closed_at,comment,magic_number,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)")
            .bind(&o.id).bind(&payload.account_id).bind(&payload.batch_id).bind(raw_ids[o.raw_key.as_str()].id)
            .bind(&o.external_order_id).bind(&o.external_position_id).bind(&o.symbol).bind(&o.order_type)
            .bind(&o.volume_initial).bind(&o.volume_current).bind(&o.open_price).bind(&o.stop_loss)
            .bind(&o.take_profit).bind(o.placed_at).bind(&o.original_placed_at).bind(o.closed_at)
            .bind(&o.original_closed_at).bind(&o.comment).bind(&o.magic_number).bind(payload.started_at)
            .execute(&mut *tx).await;
        if inserted.is_err() {
            if conflict_exists(
                &mut tx,
                "mt5_orders",
                "external_order_id",
                &payload.account_id,
                std::slice::from_ref(&o.external_order_id),
            )
            .await
            .unwrap_or(false)
            {
                return Err(ImportCommandError::new(
                    "ENTITY_CONFLICT",
                    "Imported entity IDs already exist.",
                ));
            }
            return Err(ImportCommandError::new(
                "TRANSACTION_FAILED",
                "Orders could not be inserted.",
            ));
        }
    }
    #[cfg(test)]
    inject_failure(failure_point, FailurePoint::AfterOrder)?;
    for d in &payload.deals {
        let inserted = sqlx::query("INSERT INTO mt5_deals (id,account_id,import_batch_id,raw_record_id,external_deal_id,external_order_id,external_position_id,symbol,side,entry_type,volume,price,commission,swap,profit,executed_at,original_executed_at,comment,magic_number,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)")
            .bind(&d.id).bind(&payload.account_id).bind(&payload.batch_id).bind(raw_ids[d.raw_key.as_str()].id)
            .bind(&d.external_deal_id).bind(&d.external_order_id).bind(&d.external_position_id).bind(&d.symbol)
            .bind(&d.side).bind(&d.entry_type).bind(&d.volume).bind(&d.price).bind(&d.commission).bind(&d.swap)
            .bind(&d.profit).bind(d.executed_at).bind(&d.original_executed_at).bind(&d.comment)
            .bind(&d.magic_number).bind(payload.started_at).execute(&mut *tx).await;
        if inserted.is_err() {
            if conflict_exists(
                &mut tx,
                "mt5_deals",
                "external_deal_id",
                &payload.account_id,
                std::slice::from_ref(&d.external_deal_id),
            )
            .await
            .unwrap_or(false)
            {
                return Err(ImportCommandError::new(
                    "ENTITY_CONFLICT",
                    "Imported entity IDs already exist.",
                ));
            }
            return Err(ImportCommandError::new(
                "TRANSACTION_FAILED",
                "Deals could not be inserted.",
            ));
        }
    }
    #[cfg(test)]
    inject_failure(failure_point, FailurePoint::AfterDeal)?;
    let mut trades_inserted = 0;
    for position in payload
        .positions
        .iter()
        .filter(|position| position.status == "CLOSED")
    {
        let close_price = position
            .close_price
            .as_deref()
            .ok_or_else(|| validation("Closed positions require a close price."))?;
        let closed_at = position
            .closed_at
            .ok_or_else(|| validation("Closed positions require a close time."))?;
        let original_closed_at = position
            .original_closed_at
            .as_deref()
            .ok_or_else(|| validation("Closed positions require an original close time."))?;
        insert_normalized_trade(
            &mut tx,
            PositionForNormalization {
                trade_id: format!("trade:{}:{}", payload.batch_id, position.id),
                account_id: &payload.account_id,
                import_batch_id: &payload.batch_id,
                source_position_id: &position.external_position_id,
                symbol: &position.symbol,
                side: &position.side,
                volume: &position.volume,
                opened_at: position.opened_at,
                closed_at,
                original_opened_at: &position.original_opened_at,
                original_closed_at,
                open_price: &position.open_price,
                close_price,
                stop_loss: position.stop_loss.as_deref(),
                take_profit: position.take_profit.as_deref(),
                commission: &position.commission,
                swap: &position.swap,
                profit: &position.profit,
                timestamp: payload.started_at,
            },
        )
        .await?;
        trades_inserted += 1;
    }
    #[cfg(test)]
    inject_failure(failure_point, FailurePoint::AfterTrades)?;
    let completed_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let imported_rows =
        (payload.positions.len() + payload.orders.len() + payload.deals.len()) as i64;
    #[cfg(test)]
    inject_failure(failure_point, FailurePoint::BeforeFinalUpdate)?;
    sqlx::query("UPDATE import_batches SET status='IMPORTED', total_rows=$2, imported_rows=$3, skipped_rows=$4, warning_rows=$5, error_rows=$6, completed_at=$7 WHERE id=$1")
        .bind(&payload.batch_id).bind(payload.counts.total_rows).bind(imported_rows)
        .bind(payload.counts.skipped_rows).bind(payload.counts.warning_rows).bind(payload.counts.error_rows)
        .bind(completed_at).execute(&mut *tx).await
        .map_err(|_| ImportCommandError::new("TRANSACTION_FAILED", "Import batch could not be finalized."))?;
    tx.commit().await.map_err(|_| {
        ImportCommandError::new("TRANSACTION_FAILED", "Import transaction could not commit.")
    })?;
    Ok(CommitImportResult {
        batch_id: payload.batch_id,
        raw_records_inserted: payload.raw_records.len(),
        positions_inserted: payload.positions.len(),
        orders_inserted: payload.orders.len(),
        deals_inserted: payload.deals.len(),
        trades_inserted,
        skipped_duplicates: payload.counts.skipped_rows,
        warning_count: payload.counts.warning_rows,
        error_count: payload.counts.error_rows,
        completed_at,
    })
}

pub async fn commit_with_pool(
    pool: &sqlx::SqlitePool,
    payload: CommitImportPayload,
) -> Result<CommitImportResult, ImportCommandError> {
    commit_with_pool_internal(
        pool,
        payload,
        #[cfg(test)]
        None,
    )
    .await
}

pub async fn backfill_with_pool(pool: &sqlx::SqlitePool) -> Result<usize, ImportCommandError> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(|_| {
        ImportCommandError::new(
            "TRANSACTION_FAILED",
            "Trade backfill transaction could not start.",
        )
    })?;
    let rows = sqlx::query(
        "SELECT p.id, p.account_id, p.import_batch_id, p.external_position_id,
                p.symbol, p.side, p.volume, p.opened_at, p.closed_at,
                p.original_opened_at, p.original_closed_at, p.open_price,
                p.close_price, p.stop_loss, p.take_profit, p.commission,
                p.swap, p.profit, p.created_at
           FROM mt5_positions p
          WHERE p.status = 'CLOSED'
            AND p.close_price IS NOT NULL
            AND p.closed_at IS NOT NULL
            AND p.original_closed_at IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM trades t
               WHERE t.account_id = p.account_id
                 AND t.source_type = 'MT5_POSITION'
                 AND t.source_position_id = p.external_position_id
            )
          ORDER BY p.created_at ASC, p.id ASC",
    )
    .fetch_all(&mut *tx)
    .await
    .map_err(|_| {
        ImportCommandError::new(
            "TRANSACTION_FAILED",
            "Positions for trade backfill could not be read.",
        )
    })?;
    for row in &rows {
        let position_id: String = row.get("id");
        let account_id: String = row.get("account_id");
        let import_batch_id: String = row.get("import_batch_id");
        let source_position_id: String = row.get("external_position_id");
        let symbol: String = row.get("symbol");
        let side: String = row.get("side");
        let volume: String = row.get("volume");
        let original_opened_at: String = row.get("original_opened_at");
        let original_closed_at: String = row.get("original_closed_at");
        let open_price: String = row.get("open_price");
        let close_price: String = row.get("close_price");
        let stop_loss: Option<String> = row.get("stop_loss");
        let take_profit: Option<String> = row.get("take_profit");
        let commission: String = row.get("commission");
        let swap: String = row.get("swap");
        let profit: String = row.get("profit");
        insert_normalized_trade(
            &mut tx,
            PositionForNormalization {
                trade_id: format!("trade:backfill:{position_id}"),
                account_id: &account_id,
                import_batch_id: &import_batch_id,
                source_position_id: &source_position_id,
                symbol: &symbol,
                side: &side,
                volume: &volume,
                opened_at: row.get("opened_at"),
                closed_at: row.get("closed_at"),
                original_opened_at: &original_opened_at,
                original_closed_at: &original_closed_at,
                open_price: &open_price,
                close_price: &close_price,
                stop_loss: stop_loss.as_deref(),
                take_profit: take_profit.as_deref(),
                commission: &commission,
                swap: &swap,
                profit: &profit,
                timestamp: row.get("created_at"),
            },
        )
        .await?;
    }
    tx.commit().await.map_err(|_| {
        ImportCommandError::new(
            "TRANSACTION_FAILED",
            "Trade backfill transaction could not commit.",
        )
    })?;
    Ok(rows.len())
}

#[tauri::command]
pub async fn commit_mt5_import(
    app: AppHandle,
    payload: CommitImportPayload,
) -> Result<CommitImportResult, ImportCommandError> {
    let path = resolve_database_path(&app)?;
    let pool = open_database(&path).await?;
    commit_with_pool(&pool, payload).await
}

#[tauri::command]
pub async fn backfill_missing_trades(app: AppHandle) -> Result<usize, ImportCommandError> {
    let path = resolve_database_path(&app)?;
    let pool = open_database(&path).await?;
    backfill_with_pool(&pool).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    async fn pool() -> sqlx::SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql("PRAGMA foreign_keys=ON; CREATE TABLE accounts (id TEXT PRIMARY KEY, is_archived INTEGER NOT NULL);")
            .execute(&pool).await.unwrap();
        sqlx::raw_sql(include_str!(
            "../../../src/infrastructure/database/migrations/0003_import_foundation.sql"
        ))
        .execute(&pool)
        .await
        .unwrap();
        sqlx::raw_sql(include_str!(
            "../../../src/infrastructure/database/migrations/0004_mt5_entities.sql"
        ))
        .execute(&pool)
        .await
        .unwrap();
        sqlx::raw_sql(include_str!(
            "../../../src/infrastructure/database/migrations/0005_trades.sql"
        ))
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO accounts(id,is_archived) VALUES('a',0),('b',0),('archived',1)")
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    async fn setup_schema(pool: &sqlx::SqlitePool) {
        sqlx::raw_sql("PRAGMA foreign_keys=ON; CREATE TABLE accounts (id TEXT PRIMARY KEY, is_archived INTEGER NOT NULL);")
            .execute(pool).await.unwrap();
        sqlx::raw_sql(include_str!(
            "../../../src/infrastructure/database/migrations/0003_import_foundation.sql"
        ))
        .execute(pool)
        .await
        .unwrap();
        sqlx::raw_sql(include_str!(
            "../../../src/infrastructure/database/migrations/0004_mt5_entities.sql"
        ))
        .execute(pool)
        .await
        .unwrap();
        sqlx::raw_sql(include_str!(
            "../../../src/infrastructure/database/migrations/0005_trades.sql"
        ))
        .execute(pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO accounts(id,is_archived) VALUES('a',0),('b',0),('archived',1)")
            .execute(pool)
            .await
            .unwrap();
    }

    async fn real_database_pools() -> (PathBuf, PathBuf, sqlx::SqlitePool, sqlx::SqlitePool) {
        let directory = std::env::temp_dir().join(format!(
            "forex-concurrency-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("journal.db");
        let create_options = SqliteConnectOptions::new()
            .filename(&path)
            .create_if_missing(true)
            .foreign_keys(true)
            .busy_timeout(std::time::Duration::from_secs(5))
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);
        let first = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(create_options.clone())
            .await
            .unwrap();
        setup_schema(&first).await;
        let second = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(create_options.create_if_missing(false))
            .await
            .unwrap();
        (directory, path, first, second)
    }

    fn cleanup_database_files(directory: &Path, path: &Path) {
        for candidate in [
            path.to_path_buf(),
            PathBuf::from(format!("{}-wal", path.display())),
            PathBuf::from(format!("{}-shm", path.display())),
        ] {
            if candidate.exists() {
                std::fs::remove_file(candidate).unwrap();
            }
        }
        std::fs::remove_dir(directory).unwrap();
    }

    fn payload(account: &str, sha: char) -> CommitImportPayload {
        CommitImportPayload {
            batch_id: format!("batch-{account}-{sha}"),
            account_id: account.into(),
            source: ImportSource {
                filename: "synthetic.csv".into(),
                source_type: SOURCE_TYPE.into(),
                sha256: sha.to_string().repeat(64),
                parser_version: PARSER_VERSION.into(),
                size_bytes: 100,
            },
            counts: ImportCounts {
                total_rows: 3,
                skipped_rows: 0,
                warning_rows: 0,
                error_rows: 0,
            },
            raw_records: vec![RawRecordPayload {
                id: format!("raw-{account}-{sha}"),
                key: "POSITION:1".into(),
                record_type: "POSITION".into(),
                external_id: Some("p1".into()),
                row_number: 1,
                raw_json: "{\"safe\":true}".into(),
            }],
            positions: vec![PositionPayload {
                id: format!("position-{account}-{sha}"),
                raw_key: "POSITION:1".into(),
                external_position_id: "p1".into(),
                symbol: "EURUSD".into(),
                side: "BUY".into(),
                volume: "0.10".into(),
                open_price: "1.1".into(),
                stop_loss: None,
                take_profit: None,
                opened_at: 1,
                original_opened_at: "2026.01.01 00:00:00".into(),
                close_price: Some("1.2".into()),
                closed_at: Some(2),
                original_closed_at: Some("2026.01.01 01:00:00".into()),
                commission: "0".into(),
                swap: "0".into(),
                profit: "1".into(),
                status: "CLOSED".into(),
            }],
            orders: vec![],
            deals: vec![],
            started_at: 1,
        }
    }

    fn full_payload(account: &str, sha: char) -> CommitImportPayload {
        let mut value = payload(account, sha);
        value.raw_records.extend([
            RawRecordPayload {
                id: format!("raw-order-{account}-{sha}"),
                key: "ORDER:2".into(),
                record_type: "ORDER".into(),
                external_id: Some("o1".into()),
                row_number: 2,
                raw_json: "{\"safe\":true}".into(),
            },
            RawRecordPayload {
                id: format!("raw-deal-{account}-{sha}"),
                key: "DEAL:3".into(),
                record_type: "DEAL".into(),
                external_id: Some("d1".into()),
                row_number: 3,
                raw_json: "{\"safe\":true}".into(),
            },
        ]);
        value.orders.push(OrderPayload {
            id: format!("order-{account}-{sha}"),
            raw_key: "ORDER:2".into(),
            external_order_id: "o1".into(),
            external_position_id: Some("p1".into()),
            symbol: "EURUSD".into(),
            order_type: "BUY".into(),
            volume_initial: "0.10".into(),
            volume_current: Some("0".into()),
            open_price: Some("1.1".into()),
            stop_loss: None,
            take_profit: None,
            placed_at: 1,
            original_placed_at: "2026.01.01 00:00:00".into(),
            closed_at: Some(2),
            original_closed_at: Some("2026.01.01 01:00:00".into()),
            comment: None,
            magic_number: None,
        });
        value.deals.push(DealPayload {
            id: format!("deal-{account}-{sha}"),
            raw_key: "DEAL:3".into(),
            external_deal_id: "d1".into(),
            external_order_id: Some("o1".into()),
            external_position_id: Some("p1".into()),
            symbol: "EURUSD".into(),
            side: "BUY".into(),
            entry_type: "OUT".into(),
            volume: "0.10".into(),
            price: "1.2".into(),
            commission: Some("0".into()),
            swap: Some("0".into()),
            profit: Some("1".into()),
            executed_at: 2,
            original_executed_at: "2026.01.01 01:00:00".into(),
            comment: None,
            magic_number: None,
        });
        value
    }

    fn order_payload(account: &str, sha: char) -> CommitImportPayload {
        let mut value = full_payload(account, sha);
        value.raw_records.retain(|raw| raw.record_type == "ORDER");
        value.positions.clear();
        value.deals.clear();
        value
    }

    fn deal_payload(account: &str, sha: char) -> CommitImportPayload {
        let mut value = full_payload(account, sha);
        value.raw_records.retain(|raw| raw.record_type == "DEAL");
        value.positions.clear();
        value.orders.clear();
        value
    }

    #[tokio::test]
    async fn successful_import_sets_counters_and_foreign_keys() {
        let pool = pool().await;
        let mut input = payload("a", 'a');
        input.positions[0].profit = "10.50".into();
        input.positions[0].commission = "-2.00".into();
        input.positions[0].swap = "-0.25".into();
        let result = commit_with_pool(&pool, input).await.unwrap();
        assert_eq!(result.positions_inserted, 1);
        assert_eq!(result.trades_inserted, 1);
        let row = sqlx::query("SELECT status, imported_rows FROM import_batches")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.get::<String, _>("status"), "IMPORTED");
        assert_eq!(row.get::<i64, _>("imported_rows"), 1);
        let trade = sqlx::query("SELECT net_profit, duration_ms FROM trades")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(trade.get::<String, _>("net_profit"), "8.25");
        assert_eq!(trade.get::<i64, _>("duration_ms"), 1);
        assert_eq!(
            sqlx::query("PRAGMA foreign_keys")
                .fetch_one(&pool)
                .await
                .unwrap()
                .get::<i64, _>(0),
            1
        );
    }

    #[tokio::test]
    async fn open_position_is_imported_without_a_normalized_trade() {
        let pool = pool().await;
        let mut input = payload("a", '0');
        input.positions[0].status = "OPEN".into();
        input.positions[0].close_price = None;
        input.positions[0].closed_at = None;
        input.positions[0].original_closed_at = None;
        let result = commit_with_pool(&pool, input).await.unwrap();
        assert_eq!(result.positions_inserted, 1);
        assert_eq!(result.trades_inserted, 0);
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM trades")
                .fetch_one(&pool)
                .await
                .unwrap(),
            0
        );
    }

    #[test]
    fn checked_decimal_addition_handles_valid_values_and_overflow_without_panicking() {
        assert_eq!(
            checked_net_profit("10.50", "-2.00", "-0.25").unwrap(),
            "8.25"
        );
        assert!(checked_net_profit(&Decimal::MAX.to_string(), "1", "0").is_err());
    }

    #[tokio::test]
    async fn decimal_overflow_rolls_back_the_entire_import() {
        let pool = pool().await;
        let mut input = payload("a", '9');
        input.positions[0].profit = Decimal::MAX.to_string();
        input.positions[0].commission = "1".into();
        assert_eq!(
            commit_with_pool(&pool, input).await.unwrap_err().code,
            "VALIDATION_ERROR"
        );
        for table in [
            "import_batches",
            "raw_mt5_records",
            "mt5_positions",
            "trades",
        ] {
            assert_eq!(
                sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
                    .fetch_one(&pool)
                    .await
                    .unwrap(),
                0
            );
        }
    }

    #[tokio::test]
    async fn backfill_is_idempotent_includes_archived_accounts_and_skips_open_positions() {
        let pool = pool().await;
        let mut first = payload("a", '1');
        first.positions[0].profit = "10.50".into();
        first.positions[0].commission = "-2.00".into();
        first.positions[0].swap = "-0.25".into();
        commit_with_pool(&pool, first).await.unwrap();
        commit_with_pool(&pool, payload("b", '2')).await.unwrap();
        let mut open = payload("a", '3');
        open.positions[0].external_position_id = "open-p".into();
        open.raw_records[0].external_id = Some("open-p".into());
        open.positions[0].status = "OPEN".into();
        open.positions[0].close_price = None;
        open.positions[0].closed_at = None;
        open.positions[0].original_closed_at = None;
        commit_with_pool(&pool, open).await.unwrap();
        sqlx::query("DELETE FROM trades")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE accounts SET is_archived=1 WHERE id='a'")
            .execute(&pool)
            .await
            .unwrap();

        assert_eq!(backfill_with_pool(&pool).await.unwrap(), 2);
        assert_eq!(backfill_with_pool(&pool).await.unwrap(), 0);
        let trades = sqlx::query("SELECT account_id, net_profit FROM trades ORDER BY account_id")
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(trades.len(), 2);
        assert_eq!(trades[0].get::<String, _>("account_id"), "a");
        assert_eq!(trades[0].get::<String, _>("net_profit"), "8.25");
        assert_eq!(trades[1].get::<String, _>("account_id"), "b");
    }

    #[tokio::test]
    async fn invalid_decimal_rolls_back_all_backfill_trades_and_database_remains_readable() {
        let pool = pool().await;
        commit_with_pool(&pool, payload("a", '4')).await.unwrap();
        let mut second = payload("b", '5');
        second.positions[0].external_position_id = "p2".into();
        second.raw_records[0].external_id = Some("p2".into());
        commit_with_pool(&pool, second).await.unwrap();
        sqlx::query("DELETE FROM trades")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE mt5_positions SET profit='not-decimal' WHERE account_id='b'")
            .execute(&pool)
            .await
            .unwrap();
        assert_eq!(
            backfill_with_pool(&pool).await.unwrap_err().code,
            "VALIDATION_ERROR"
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM trades")
                .fetch_one(&pool)
                .await
                .unwrap(),
            0
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM accounts")
                .fetch_one(&pool)
                .await
                .unwrap(),
            3
        );
    }

    #[tokio::test]
    async fn duplicate_source_is_typed_and_idempotent() {
        let pool = pool().await;
        commit_with_pool(&pool, payload("a", 'b')).await.unwrap();
        let error = commit_with_pool(&pool, payload("a", 'b'))
            .await
            .unwrap_err();
        assert_eq!(error.code, "DUPLICATE_IMPORT");
        assert!(error.existing_batch_id.is_some());
        assert_eq!(
            sqlx::query("SELECT id FROM import_batches")
                .fetch_all(&pool)
                .await
                .unwrap()
                .len(),
            1
        );
    }

    #[tokio::test]
    async fn two_real_pools_serialize_concurrent_same_source_imports() {
        let (directory, path, first_pool, second_pool) = real_database_pools().await;
        let (first, second) = tokio::join!(
            commit_with_pool(&first_pool, payload("a", '8')),
            commit_with_pool(&second_pool, payload("a", '8'))
        );
        let outcomes = [first, second];
        assert_eq!(outcomes.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(
            outcomes
                .iter()
                .filter(|result| result.as_ref().is_err_and(|error| {
                    error.code == "DUPLICATE_IMPORT" && error.existing_batch_id.is_some()
                }))
                .count(),
            1
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM import_batches")
                .fetch_one(&first_pool)
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM raw_mt5_records")
                .fetch_one(&first_pool)
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM mt5_positions")
                .fetch_one(&first_pool)
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM accounts")
                .fetch_one(&second_pool)
                .await
                .unwrap(),
            3
        );
        first_pool.close().await;
        second_pool.close().await;
        cleanup_database_files(&directory, &path);
    }

    #[tokio::test]
    async fn raw_unique_conflicts_are_typed_without_partial_rows() {
        let scenarios = [
            ("mt5_positions", payload("a", '1'), payload("a", '2')),
            (
                "mt5_orders",
                order_payload("a", '3'),
                order_payload("a", '4'),
            ),
            ("mt5_deals", deal_payload("a", '5'), deal_payload("a", '6')),
        ];
        for (entity_table, first, second) in scenarios {
            let pool = pool().await;
            commit_with_pool(&pool, first).await.unwrap();
            sqlx::query(&format!("DELETE FROM {entity_table}"))
                .execute(&pool)
                .await
                .unwrap();
            assert_eq!(
                commit_with_pool(&pool, second).await.unwrap_err().code,
                "ENTITY_CONFLICT"
            );
            assert_eq!(
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM import_batches")
                    .fetch_one(&pool)
                    .await
                    .unwrap(),
                1
            );
            assert_eq!(
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM raw_mt5_records")
                    .fetch_one(&pool)
                    .await
                    .unwrap(),
                1
            );
            assert_eq!(
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM mt5_positions")
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                    + sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM mt5_orders")
                        .fetch_one(&pool)
                        .await
                        .unwrap()
                    + sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM mt5_deals")
                        .fetch_one(&pool)
                        .await
                        .unwrap(),
                0
            );
            assert_eq!(
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM accounts")
                    .fetch_one(&pool)
                    .await
                    .unwrap(),
                3
            );
        }
    }

    #[tokio::test]
    async fn account_and_external_ids_are_account_scoped() {
        let pool = pool().await;
        commit_with_pool(&pool, payload("a", 'c')).await.unwrap();
        commit_with_pool(&pool, payload("b", 'c')).await.unwrap();
        assert_eq!(
            sqlx::query("SELECT id FROM mt5_positions")
                .fetch_all(&pool)
                .await
                .unwrap()
                .len(),
            2
        );
    }

    #[tokio::test]
    async fn missing_and_archived_accounts_are_rejected_without_pending_batch() {
        let pool = pool().await;
        assert_eq!(
            commit_with_pool(&pool, payload("missing", 'd'))
                .await
                .unwrap_err()
                .code,
            "ACCOUNT_NOT_FOUND"
        );
        assert_eq!(
            commit_with_pool(&pool, payload("archived", 'e'))
                .await
                .unwrap_err()
                .code,
            "ACCOUNT_ARCHIVED"
        );
        assert!(sqlx::query("SELECT id FROM import_batches")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty());
    }

    #[tokio::test]
    async fn invalid_payloads_fail_before_writes() {
        let pool = pool().await;
        let mut invalid = payload("a", 'f');
        invalid.source.sha256 = "bad".into();
        assert_eq!(
            commit_with_pool(&pool, invalid).await.unwrap_err().code,
            "VALIDATION_ERROR"
        );
        let mut missing_raw = payload("a", 'g');
        missing_raw.positions[0].raw_key = "missing".into();
        assert_eq!(
            commit_with_pool(&pool, missing_raw).await.unwrap_err().code,
            "VALIDATION_ERROR"
        );
        let mut decimal = payload("a", 'h');
        decimal.positions[0].volume = "1e3".into();
        assert_eq!(
            commit_with_pool(&pool, decimal).await.unwrap_err().code,
            "VALIDATION_ERROR"
        );
        let mut provenance = payload("a", 'i');
        provenance.raw_records[0].external_id = Some("other".into());
        assert_eq!(
            commit_with_pool(&pool, provenance).await.unwrap_err().code,
            "VALIDATION_ERROR"
        );
        let mut timestamps = payload("a", 'j');
        timestamps.positions[0].closed_at = Some(0);
        assert_eq!(
            commit_with_pool(&pool, timestamps).await.unwrap_err().code,
            "VALIDATION_ERROR"
        );
        let mut optional_decimal = full_payload("a", 'k');
        optional_decimal.orders[0].stop_loss = Some("1e3".into());
        assert_eq!(
            commit_with_pool(&pool, optional_decimal)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        let mut unknown_type = payload("a", '1');
        unknown_type.raw_records[0].record_type = "UNKNOWN".into();
        assert_eq!(
            commit_with_pool(&pool, unknown_type)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        let mut missing_external = payload("a", '2');
        missing_external.raw_records[0].external_id = None;
        assert_eq!(
            commit_with_pool(&pool, missing_external)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        let mut result_external = payload("a", '3');
        result_external.positions.clear();
        result_external.raw_records[0].record_type = "RESULT".into();
        assert_eq!(
            commit_with_pool(&pool, result_external)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        let mut invalid_limits = payload("a", '4');
        invalid_limits.started_at = -1;
        assert_eq!(
            commit_with_pool(&pool, invalid_limits)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        let mut empty_source = payload("a", '5');
        empty_source.source.size_bytes = 0;
        assert_eq!(
            commit_with_pool(&pool, empty_source)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        let mut too_many_raw = payload("a", '6');
        too_many_raw.counts.total_rows = 0;
        assert_eq!(
            commit_with_pool(&pool, too_many_raw)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        let mut oversized_symbol = payload("a", '7');
        oversized_symbol.positions[0].symbol = "X".repeat(MAX_SYMBOL_BYTES + 1);
        assert_eq!(
            commit_with_pool(&pool, oversized_symbol)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        let mut oversized_raw = payload("a", '8');
        oversized_raw.raw_records[0].raw_json =
            format!("\"{}\"", "x".repeat(MAX_RAW_JSON_RECORD_BYTES));
        assert_eq!(
            commit_with_pool(&pool, oversized_raw)
                .await
                .unwrap_err()
                .code,
            "VALIDATION_ERROR"
        );
        assert!(sqlx::query("SELECT id FROM import_batches")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty());
    }

    #[tokio::test]
    async fn every_injected_stage_failure_rolls_back_all_business_rows() {
        let points = [
            FailurePoint::AfterBatch,
            FailurePoint::AfterRaw,
            FailurePoint::AfterPosition,
            FailurePoint::AfterOrder,
            FailurePoint::AfterDeal,
            FailurePoint::AfterTrades,
            FailurePoint::BeforeFinalUpdate,
        ];
        for (sha, point) in ['a', 'b', 'c', 'd', 'e', 'f', '7'].into_iter().zip(points) {
            let pool = pool().await;
            let error = commit_with_pool_internal(&pool, full_payload("a", sha), Some(point))
                .await
                .unwrap_err();
            assert_eq!(error.code, "TRANSACTION_FAILED", "{point:?}");
            for table in [
                "import_batches",
                "raw_mt5_records",
                "mt5_positions",
                "mt5_orders",
                "mt5_deals",
                "trades",
            ] {
                let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
                    .fetch_one(&pool)
                    .await
                    .unwrap();
                assert_eq!(count, 0, "{point:?} left rows in {table}");
            }
            assert_eq!(
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM accounts")
                    .fetch_one(&pool)
                    .await
                    .unwrap(),
                3,
                "database unreadable after {point:?}"
            );
        }
    }
}
