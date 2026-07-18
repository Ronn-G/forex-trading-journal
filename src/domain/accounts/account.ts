/**
 * Account Domain Model
 *
 * Pure domain model independent of React, Tauri, and SQL.
 * Contains types, Zod validation schemas, and domain logic
 * for trading account management.
 */
import { z } from "zod/v4";

// Constants

/**
 * ISO 4217 currency codes commonly used in forex trading.
 * Not an exhaustive list — validation only checks format (3 uppercase letters).
 */
export const COMMON_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF",
  "SGD", "HKD", "CNY", "THB", "VND",
] as const;

/**
 * Well-known account types. The field is not restricted to this list
 * to support broker-specific types that documentation hasn't finalized.
 */
export const KNOWN_ACCOUNT_TYPES = [
  "Hedge", "Netting", "Standard", "ECN", "Pro", "Raw", "Cent",
] as const;

// Domain types

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly broker: string;
  readonly server: string;
  readonly loginMasked: string;
  readonly accountCurrency: string;
  readonly accountType: string;
  readonly timezone: string;
  readonly isDemo: boolean;
  readonly isArchived: boolean;
  readonly createdAt: number; // epoch ms UTC
  readonly updatedAt: number; // epoch ms UTC
}

export interface CreateAccountInput {
  readonly name: string;
  readonly broker: string;
  readonly server: string;
  readonly loginMasked: string;
  readonly accountCurrency: string;
  readonly accountType: string;
  readonly timezone: string;
  readonly isDemo: boolean;
}

export interface UpdateAccountInput {
  readonly id: string;
  readonly name: string;
  readonly broker: string;
  readonly server: string;
  readonly loginMasked: string;
  readonly accountCurrency: string;
  readonly accountType: string;
  readonly timezone: string;
  readonly isDemo: boolean;
}

// Validation helpers

/**
 * Patterns that suggest a field contains a secret.
 * Used to reject loginMasked values that look like passwords or tokens.
 */
const SECRET_PATTERNS = [
  /password/i,
  /^[A-Za-z0-9+/]{20,}={0,2}$/,  // base64-like
  /^[a-f0-9]{32,}$/i,             // hex hash-like
  /^ey[A-Za-z0-9]/,               // JWT-like
];

/**
 * Validate that a timezone string is a valid IANA timezone.
 * Uses Intl.DateTimeFormat which throws for invalid timezones.
 */
export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a value looks like a secret/password.
 */
export function looksLikeSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Validate ISO 4217 currency code format: exactly 3 uppercase ASCII letters.
 */
export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

// Zod schemas

/**
 * Trimmed non-empty string with configurable min/max length.
 */
function trimmedString(fieldName: string, minLen = 1, maxLen = 255) {
  return z
    .string()
    .transform((s) => s.trim())
    .check(
      z.refine((s) => s.length >= minLen, {
        message: `${fieldName} is required`,
      }),
      z.refine((s) => s.length <= maxLen, {
        message: `${fieldName} must be at most ${maxLen} characters`,
      }),
    );
}

/**
 * Schema for currency code: must be 3 uppercase letters after trim + uppercase.
 */
const currencySchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .check(
    z.refine((s) => s.length > 0, { message: "Currency is required" }),
    z.refine((s) => isValidCurrencyCode(s), {
      message: "Currency must be a valid 3-letter code (e.g., USD)",
    }),
  );

/**
 * Schema for IANA timezone.
 */
const timezoneSchema = z
  .string()
  .transform((s) => s.trim())
  .check(
    z.refine((s) => s.length > 0, { message: "Timezone is required" }),
    z.refine((s) => isValidIanaTimezone(s), {
      message: "Invalid IANA timezone (e.g., Asia/Ho_Chi_Minh, Etc/GMT-2)",
    }),
  );

/**
 * Schema for loginMasked: must not be empty and must not look like a secret.
 */
const loginMaskedSchema = z
  .string()
  .transform((s) => s.trim())
  .check(
    z.refine((s) => s.length > 0, { message: "Masked login is required" }),
    z.refine((s) => /[*xX•]/.test(s), {
      message: "Login must be masked (e.g., ***1234)",
    }),
    z.refine((s) => !looksLikeSecret(s), {
      message: "Login value appears to contain a password or secret. Use a masked version (e.g., ***1234)",
    }),
  );

/**
 * Zod schema for CreateAccountInput.
 */
export const CreateAccountInputSchema = z.object({
  name: trimmedString("Name"),
  broker: trimmedString("Broker"),
  server: trimmedString("Server"),
  loginMasked: loginMaskedSchema,
  accountCurrency: currencySchema,
  accountType: trimmedString("Account type"),
  timezone: timezoneSchema,
  isDemo: z.boolean(),
});

/**
 * Zod schema for UpdateAccountInput.
 */
export const UpdateAccountInputSchema = z.object({
  id: z.string().check(z.refine((s) => s.length > 0, { message: "Account ID is required" })),
  name: trimmedString("Name"),
  broker: trimmedString("Broker"),
  server: trimmedString("Server"),
  loginMasked: loginMaskedSchema,
  accountCurrency: currencySchema,
  accountType: trimmedString("Account type"),
  timezone: timezoneSchema,
  isDemo: z.boolean(),
});

// Validation error types

export interface ValidationFieldError {
  readonly field: string;
  readonly message: string;
}

export interface AccountValidationResult {
  readonly success: boolean;
  readonly errors: ValidationFieldError[];
}

/**
 * Validate CreateAccountInput and return structured errors.
 */
export function validateCreateAccountInput(
  input: unknown,
): AccountValidationResult {
  const result = CreateAccountInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, errors: [] };
  }

  const errors: ValidationFieldError[] = z.treeifyError(result.error).properties
    ? Object.entries(z.treeifyError(result.error).properties!).map(
        ([field, fieldError]) => ({
          field,
          message: (fieldError as { errors: string[] }).errors?.[0] ?? "Invalid value",
        }),
      )
    : [];

  return { success: false, errors };
}

/**
 * Validate UpdateAccountInput and return structured errors.
 */
export function validateUpdateAccountInput(
  input: unknown,
): AccountValidationResult {
  const result = UpdateAccountInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, errors: [] };
  }

  const errors: ValidationFieldError[] = z.treeifyError(result.error).properties
    ? Object.entries(z.treeifyError(result.error).properties!).map(
        ([field, fieldError]) => ({
          field,
          message: (fieldError as { errors: string[] }).errors?.[0] ?? "Invalid value",
        }),
      )
    : [];

  return { success: false, errors };
}

// Normalization

/**
 * Normalize account fields for duplicate detection.
 * Trims whitespace and lowercases broker, server, and loginMasked.
 * Used by the service layer for duplicate comparison.
 */
export function normalizeForDuplicateCheck(
  broker: string,
  server: string,
  loginMasked: string,
): { broker: string; server: string; loginMasked: string } {
  return {
    broker: broker.trim().toLowerCase(),
    server: server.trim().toLowerCase(),
    loginMasked: loginMasked.trim().toLowerCase(),
  };
}
