use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitImportPayload {
    pub batch_id: String,
    pub account_id: String,
    pub source: ImportSource,
    pub counts: ImportCounts,
    pub raw_records: Vec<RawRecordPayload>,
    pub positions: Vec<PositionPayload>,
    pub orders: Vec<OrderPayload>,
    pub deals: Vec<DealPayload>,
    pub started_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSource {
    pub filename: String,
    pub source_type: String,
    pub sha256: String,
    pub parser_version: String,
    pub size_bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCounts {
    pub total_rows: i64,
    pub skipped_rows: i64,
    pub warning_rows: i64,
    pub error_rows: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawRecordPayload {
    pub id: String,
    pub key: String,
    pub record_type: String,
    pub external_id: Option<String>,
    pub row_number: i64,
    pub raw_json: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionPayload {
    pub id: String,
    pub raw_key: String,
    pub external_position_id: String,
    pub symbol: String,
    pub side: String,
    pub volume: String,
    pub open_price: String,
    pub stop_loss: Option<String>,
    pub take_profit: Option<String>,
    pub opened_at: i64,
    pub original_opened_at: String,
    pub close_price: Option<String>,
    pub closed_at: Option<i64>,
    pub original_closed_at: Option<String>,
    pub commission: String,
    pub swap: String,
    pub profit: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderPayload {
    pub id: String,
    pub raw_key: String,
    pub external_order_id: String,
    pub external_position_id: Option<String>,
    pub symbol: String,
    pub order_type: String,
    pub volume_initial: String,
    pub volume_current: Option<String>,
    pub open_price: Option<String>,
    pub stop_loss: Option<String>,
    pub take_profit: Option<String>,
    pub placed_at: i64,
    pub original_placed_at: String,
    pub closed_at: Option<i64>,
    pub original_closed_at: Option<String>,
    pub comment: Option<String>,
    pub magic_number: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DealPayload {
    pub id: String,
    pub raw_key: String,
    pub external_deal_id: String,
    pub external_order_id: Option<String>,
    pub external_position_id: Option<String>,
    pub symbol: String,
    pub side: String,
    pub entry_type: String,
    pub volume: String,
    pub price: String,
    pub commission: Option<String>,
    pub swap: Option<String>,
    pub profit: Option<String>,
    pub executed_at: i64,
    pub original_executed_at: String,
    pub comment: Option<String>,
    pub magic_number: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitImportResult {
    pub batch_id: String,
    pub raw_records_inserted: usize,
    pub positions_inserted: usize,
    pub orders_inserted: usize,
    pub deals_inserted: usize,
    pub skipped_duplicates: i64,
    pub warning_count: i64,
    pub error_count: i64,
    pub completed_at: i64,
}
