import { useState, type FormEvent } from "react";
import type {
  Account,
  CreateAccountInput,
  ValidationFieldError,
} from "../../domain/accounts/account";

interface AccountFormProps {
  account?: Account;
  busy: boolean;
  fieldErrors: ValidationFieldError[];
  onCancel: () => void;
  onSubmit: (input: CreateAccountInput) => Promise<void>;
}

const defaults: CreateAccountInput = {
  name: "",
  broker: "",
  server: "",
  loginMasked: "",
  accountCurrency: "USD",
  accountType: "Hedge",
  timezone: "Asia/Ho_Chi_Minh",
  isDemo: false,
};

export function AccountForm({
  account,
  busy,
  fieldErrors,
  onCancel,
  onSubmit,
}: AccountFormProps) {
  const [values, setValues] = useState<CreateAccountInput>(
    account
      ? {
          name: account.name,
          broker: account.broker,
          server: account.server,
          loginMasked: account.loginMasked,
          accountCurrency: account.accountCurrency,
          accountType: account.accountType,
          timezone: account.timezone,
          isDemo: account.isDemo,
        }
      : defaults,
  );
  const errors = new Map(fieldErrors.map((error) => [error.field, error.message]));

  function setField<K extends keyof CreateAccountInput>(
    field: K,
    value: CreateAccountInput[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  const textFields: Array<{
    key: Exclude<keyof CreateAccountInput, "isDemo">;
    label: string;
    placeholder?: string;
  }> = [
    { key: "name", label: "Tên hiển thị" },
    { key: "broker", label: "Broker" },
    { key: "server", label: "Server" },
    { key: "loginMasked", label: "Login đã che", placeholder: "***1234" },
    { key: "accountCurrency", label: "Tiền tệ" },
    { key: "accountType", label: "Loại tài khoản" },
    { key: "timezone", label: "Múi giờ IANA", placeholder: "Asia/Ho_Chi_Minh" },
  ];

  return (
    <form
      aria-label={account ? "Chỉnh sửa tài khoản" : "Tạo tài khoản"}
      onSubmit={submit}
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
    >
      <h2 className="text-xl font-semibold">
        {account ? "Chỉnh sửa tài khoản" : "Tạo tài khoản"}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {textFields.map((field) => (
          <label key={field.key} className="text-sm text-slate-300">
            <span className="block mb-1">{field.label}</span>
            <input
              name={field.key}
              value={values[field.key]}
              placeholder={field.placeholder}
              aria-invalid={errors.has(field.key)}
              onChange={(event) => setField(field.key, event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
            {errors.has(field.key) && (
              <span role="alert" className="block mt-1 text-xs text-red-400">
                {errors.get(field.key)}
              </span>
            )}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          name="isDemo"
          type="checkbox"
          checked={values.isDemo}
          onChange={(event) => setField("isDemo", event.target.checked)}
        />
        Tài khoản demo
      </label>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Đang lưu..." : "Lưu tài khoản"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm">
          Hủy
        </button>
      </div>
    </form>
  );
}
