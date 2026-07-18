import type { Account } from "../../domain/accounts/account";

interface AccountListProps {
  accounts: Account[];
  archived: boolean;
  busyId: string | null;
  onEdit: (account: Account) => void;
  onToggleArchive: (account: Account) => Promise<void>;
}

export function AccountList({
  accounts,
  archived,
  busyId,
  onEdit,
  onToggleArchive,
}: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
        <h2 className="font-semibold text-slate-200">
          {archived ? "Chưa có tài khoản lưu trữ" : "Chưa có tài khoản"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {archived
            ? "Tài khoản đã lưu trữ sẽ xuất hiện tại đây."
            : "Tạo tài khoản đầu tiên để chuẩn bị nhập lịch sử MT5."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="px-4 py-3">Tên</th>
            <th className="px-4 py-3">Broker / Server</th>
            <th className="px-4 py-3">Login</th>
            <th className="px-4 py-3">Loại</th>
            <th className="px-4 py-3">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/40">
          {accounts.map((account) => (
            <tr key={account.id}>
              <td className="px-4 py-3 font-medium">{account.name}</td>
              <td className="px-4 py-3 text-slate-300">
                {account.broker} / {account.server}
              </td>
              <td className="px-4 py-3 font-mono">{account.loginMasked}</td>
              <td className="px-4 py-3">
                {account.accountCurrency} · {account.accountType} ·{" "}
                {account.isDemo ? "Demo" : "Real"}
              </td>
              <td className="px-4 py-3 space-x-3">
                <button onClick={() => onEdit(account)} className="text-indigo-400">
                  Sửa
                </button>
                <button
                  disabled={busyId === account.id}
                  onClick={() => void onToggleArchive(account)}
                  className="text-amber-400 disabled:opacity-50"
                >
                  {account.isArchived ? "Khôi phục" : "Lưu trữ"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
