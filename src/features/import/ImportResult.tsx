import type { CommitImportResult } from "../../application/import/ImportService";

export function ImportResult({ result, onReset }: {
  readonly result: CommitImportResult;
  readonly onReset: () => void;
}) {
  return <div className="space-y-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6">
    <h2 className="text-2xl font-bold text-emerald-300">Nhập dữ liệu thành công</h2>
    <p className="font-mono text-sm">Batch: {result.batchId.slice(0, 12)}…</p>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <p>Raw: {result.rawRecordsInserted}</p><p>Positions: {result.positionsInserted}</p>
      <p>Orders: {result.ordersInserted}</p><p>Deals: {result.dealsInserted}</p>
      <p>Trades: {result.tradesInserted}</p>
      <p>Bỏ qua: {result.skippedDuplicates}</p><p>Warnings: {result.warningCount}</p>
      <p>Errors: {result.errorCount}</p><p>{new Date(result.completedAt).toLocaleString()}</p>
    </div>
    <button className="rounded-lg border border-slate-600 px-4 py-2" onClick={onReset}>Nhập file khác</button>
  </div>;
}
