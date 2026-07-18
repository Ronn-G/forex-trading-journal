import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AccountService } from "../../application/accounts/AccountService";
import { ImportPreviewService } from "../../application/import/ImportPreviewService";
import { ImportCommitError, ImportService, type CommitImportResult } from "../../application/import/ImportService";
import type { Account } from "../../domain/accounts/account";
import type { ImportPreview } from "../../domain/import/import";
import { SqlAccountRepository } from "../../infrastructure/database/repositories/SqlAccountRepository";
import { SqlImportReadRepository } from "../../infrastructure/database/repositories/SqlImportReadRepository";
import { VantageMt5CsvParser } from "../../infrastructure/import/mt5Csv/vantageMt5CsvParser";
import { ImportFilePicker } from "./ImportFilePicker";
import { ImportPreview as PreviewView } from "./ImportPreview";
import { ImportResult } from "./ImportResult";

interface ImportScreenProps {
  readonly accountService?: Pick<AccountService, "list">;
  readonly previewService?: Pick<ImportPreviewService, "preview">;
  readonly importService?: Pick<ImportService, "commit">;
}
export function ImportScreen({ accountService: suppliedAccountService, previewService: suppliedPreviewService,
  importService: suppliedImportService }: ImportScreenProps = {}) {
  const accountService = useMemo(() => suppliedAccountService ??
    new AccountService(new SqlAccountRepository()), [suppliedAccountService]);
  const previewService = useMemo(() => suppliedPreviewService ??
    new ImportPreviewService(new VantageMt5CsvParser(), new SqlImportReadRepository()), [suppliedPreviewService]);
  const importService = useMemo(() => suppliedImportService ?? new ImportService(), [suppliedImportService]);
  const [accounts, setAccounts] = useState<Account[]>([]); const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(true); const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null); const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<CommitImportResult | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const rows = await accountService.list("active"); setAccounts(rows); setAccountId((current) => current || rows[0]?.id || ""); }
    catch { setError("Không thể tải tài khoản đang hoạt động."); } finally { setLoading(false); }
  }, [accountService]);
  useEffect(() => { void load(); }, [load]);
  async function selectFile(file: File) {
    const account = accounts.find((item) => item.id === accountId); if (!account) return;
    setParsing(true); setError(null);
    try { setPreview(await previewService.preview(account, file)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể đọc báo cáo."); }
    finally { setParsing(false); }
  }
  async function commit() {
    if (!preview || committing) return;
    const account = accounts.find((item) => item.id === accountId);
    if (!account || !window.confirm(`Nhập dữ liệu từ ${preview.filename} vào ${account.name}?`)) return;
    setCommitting(true); setError(null);
    try { setResult(await importService.commit(preview, account.id, preview.sourceSha256)); }
    catch (caught) {
      if (caught instanceof ImportCommitError && caught.code === "DUPLICATE_IMPORT") {
        setError("File này đã được nhập trước đó cho tài khoản đã chọn.");
      } else if (caught instanceof ImportCommitError && caught.code === "ACCOUNT_ARCHIVED") {
        setError("Tài khoản đã được lưu trữ và không thể nhận dữ liệu import.");
      } else {
        setError("Không thể hoàn tất nhập dữ liệu. Không có dữ liệu một phần được giữ lại.");
      }
    } finally { setCommitting(false); }
  }
  const reset = () => { setPreview(null); setResult(null); setError(null); };
  return <div className="mx-auto max-w-6xl p-8">
    <h1 className="text-3xl font-extrabold">Xem trước nhập MT5</h1>
    <p className="mb-6 mt-2 text-slate-400">File được đọc hoàn toàn trên thiết bị. Xem trước không ghi dữ liệu giao dịch.</p>
    {error && <div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-950/30 p-4 text-red-300">{error}{" "}
      <button className="underline" onClick={() => { setError(null); setPreview(null); }}>Thử lại</button></div>}
    {loading ? <div role="status">Đang tải tài khoản…</div> : result ? <ImportResult result={result} onReset={reset} /> :
      accounts.length === 0 ?
      <div className="rounded-xl border border-slate-800 p-6">Bạn cần tạo một tài khoản đang hoạt động trước.{" "}
        <Link className="text-indigo-400 underline" to="/accounts">Mở trang tài khoản</Link></div> :
      preview ? <PreviewView preview={preview} accountName={accounts.find((item) => item.id === accountId)?.name ?? ""}
        committing={committing} onCommit={() => void commit()} onReset={reset} /> :
      <div className="space-y-5"><label className="block">Tài khoản
        <select className="ml-3 rounded bg-slate-900 p-2" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.loginMasked}</option>)}
        </select></label>
        {parsing ? <div role="status">Đang kiểm tra và phân tích báo cáo…</div> :
          <ImportFilePicker disabled={!accountId} onSelect={(file) => void selectFile(file)} />}</div>}
  </div>;
}
