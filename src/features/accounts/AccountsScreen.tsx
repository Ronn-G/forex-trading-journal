import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccountInputError,
  AccountService,
  DuplicateAccountError,
} from "../../application/accounts/AccountService";
import type {
  Account,
  CreateAccountInput,
  ValidationFieldError,
} from "../../domain/accounts/account";
import type { AccountArchiveFilter } from "../../domain/accounts/AccountRepository";
import { SqlAccountRepository } from "../../infrastructure/database/repositories/SqlAccountRepository";
import { AccountForm } from "./AccountForm";
import { AccountList } from "./AccountList";

interface AccountsScreenProps {
  service?: AccountService;
}

export function AccountsScreen({ service: suppliedService }: AccountsScreenProps) {
  const service = useMemo(
    () => suppliedService ?? new AccountService(new SqlAccountRepository()),
    [suppliedService],
  );
  const [filter, setFilter] = useState<AccountArchiveFilter>("active");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [fieldErrors, setFieldErrors] = useState<ValidationFieldError[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await service.list(filter));
    } catch {
      setError("Không thể tải danh sách tài khoản. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [filter, service]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(undefined);
    setFieldErrors([]);
    setFormOpen(true);
  }

  async function submit(input: CreateAccountInput) {
    setSaving(true);
    setError(null);
    setFieldErrors([]);
    try {
      if (editing) {
        await service.update({ id: editing.id, ...input });
      } else {
        await service.create(input);
      }
      setFormOpen(false);
      setEditing(undefined);
      await load();
    } catch (caught) {
      if (caught instanceof AccountInputError) {
        setFieldErrors(caught.fieldErrors);
      } else if (caught instanceof DuplicateAccountError) {
        setError("Tài khoản trùng broker, server và login đã che.");
      } else {
        setError("Không thể lưu tài khoản. Dữ liệu chưa được thay đổi.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive(account: Account) {
    setBusyId(account.id);
    setError(null);
    try {
      if (account.isArchived) {
        await service.unarchive(account.id);
      } else {
        await service.archive(account.id);
      }
      await load();
    } catch {
      setError("Không thể thay đổi trạng thái lưu trữ. Vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Tài Khoản Giao Dịch</h1>
          <p className="mt-2 text-slate-400">Quản lý metadata tài khoản; không lưu mật khẩu hoặc token.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold">
          Tạo tài khoản
        </button>
      </div>

      <div className="mb-6 flex gap-2" aria-label="Bộ lọc tài khoản">
        <button
          aria-pressed={filter === "active"}
          onClick={() => setFilter("active")}
          className="rounded-lg border border-slate-700 px-3 py-2 aria-pressed:bg-indigo-600"
        >
          Đang hoạt động
        </button>
        <button
          aria-pressed={filter === "archived"}
          onClick={() => setFilter("archived")}
          className="rounded-lg border border-slate-700 px-3 py-2 aria-pressed:bg-indigo-600"
        >
          Đã lưu trữ
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-950/30 p-4 text-red-300">
          {error}{" "}
          <button onClick={() => void load()} className="underline">
            Thử lại
          </button>
        </div>
      )}

      {formOpen && (
        <div className="mb-6">
          <AccountForm
            key={editing?.id ?? "new"}
            account={editing}
            busy={saving}
            fieldErrors={fieldErrors}
            onCancel={() => setFormOpen(false)}
            onSubmit={submit}
          />
        </div>
      )}

      {loading ? (
        <div role="status" className="p-12 text-center text-slate-400">
          Đang tải tài khoản...
        </div>
      ) : (
        <AccountList
          accounts={accounts}
          archived={filter === "archived"}
          busyId={busyId}
          onEdit={(account) => {
            setEditing(account);
            setFieldErrors([]);
            setFormOpen(true);
          }}
          onToggleArchive={toggleArchive}
        />
      )}
    </div>
  );
}
