import { describe, expect, it } from "vitest";
import {
  CreateAccountInputSchema,
  looksLikeSecret,
  normalizeForDuplicateCheck,
  validateCreateAccountInput,
} from "./account";

const validInput = {
  name: "Main",
  broker: "Vantage",
  server: "Live 13",
  loginMasked: "***1234",
  accountCurrency: "usd",
  accountType: "Hedge",
  timezone: "Asia/Ho_Chi_Minh",
  isDemo: false,
};

describe("account domain", () => {
  it("normalizes a valid currency and trimmed fields", () => {
    const parsed = CreateAccountInputSchema.parse({
      ...validInput,
      name: " Main ",
    });
    expect(parsed.name).toBe("Main");
    expect(parsed.accountCurrency).toBe("USD");
  });

  it("returns field-level errors for required and invalid values", () => {
    const result = validateCreateAccountInput({
      ...validInput,
      name: "",
      timezone: "GMT+7",
    });
    expect(result.success).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(["name", "timezone"]),
    );
  });

  it("rejects values that appear to contain secrets", () => {
    expect(looksLikeSecret("password=hello")).toBe(true);
    expect(() =>
      CreateAccountInputSchema.parse({
        ...validInput,
        loginMasked: "password=hello",
      }),
    ).toThrow();
    expect(() =>
      CreateAccountInputSchema.parse({
        ...validInput,
        loginMasked: "12345678",
      }),
    ).toThrow();
  });

  it("normalizes the business identity consistently", () => {
    expect(normalizeForDuplicateCheck(" VANTAGE ", " LIVE ", " ***AB ")).toEqual({
      broker: "vantage",
      server: "live",
      loginMasked: "***ab",
    });
  });
});
