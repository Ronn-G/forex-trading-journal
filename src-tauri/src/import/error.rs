use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCommandError {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_batch_id: Option<String>,
}

impl ImportCommandError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            existing_batch_id: None,
        }
    }

    pub fn duplicate(batch_id: String) -> Self {
        Self {
            code: "DUPLICATE_IMPORT",
            message: "This file was already imported for the selected account.".into(),
            existing_batch_id: Some(batch_id),
        }
    }
}
