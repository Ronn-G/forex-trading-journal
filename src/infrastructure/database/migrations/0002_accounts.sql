-- Migration 0002: Trading Accounts
-- Creates the accounts table for managing trading accounts.

CREATE TABLE accounts (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    broker            TEXT NOT NULL,
    server            TEXT NOT NULL,
    login_masked      TEXT NOT NULL,
    account_currency  TEXT NOT NULL,
    account_type      TEXT NOT NULL,
    timezone          TEXT NOT NULL,
    is_demo           INTEGER NOT NULL CHECK (is_demo IN (0, 1)),
    is_archived       INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);

-- Index for listing active/archived accounts sorted by name
CREATE INDEX idx_accounts_archived_name ON accounts (is_archived, name);

-- Index for broker/server lookups (duplicate detection, grouping)
CREATE INDEX idx_accounts_broker_server ON accounts (broker, server);
