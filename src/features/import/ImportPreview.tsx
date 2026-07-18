import type { ImportPreview as Preview } from "../../domain/import/import";
import { ImportIssueList } from "./ImportIssueList";
export function ImportPreview({ preview, onReset }: { readonly preview: Preview; readonly onReset: () => void }) {
  return <div className="space-y-6">
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-bold">File</h2><p>{preview.filename} · {(preview.fileSize / 1024).toFixed(1)} KB</p>
      <p className="font-mono text-sm text-slate-400">SHA-256: {preview.sourceSha256.slice(0, 12)}…</p>
      <p>{preview.format} · {preview.parserVersion}</p>
      {preview.duplicateFile && <p className="mt-2 text-amber-400">File này đã từng được nhập cho tài khoản đã chọn.</p>}
    </section>
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-bold">Báo cáo</h2>
      <p>Login: {preview.metadata.loginMasked ?? "Không rõ"} · {preview.metadata.currency ?? "—"} · {preview.metadata.server ?? "—"}</p>
      <p>{preview.metadata.environment ?? "—"} · {preview.metadata.accountMode ?? "—"} · múi giờ {preview.timezone}</p>
    </section>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-5">{Object.entries(preview.counts).map(([label, value]) =>
      <div key={label} className="rounded-lg border border-slate-800 p-3"><div className="text-xs uppercase text-slate-400">{label}</div>
        <div className="text-2xl font-bold">{value}</div></div>)}</section>
    <section><h2 className="mb-3 text-xl font-bold">Vấn đề mẫu</h2><ImportIssueList issues={preview.issues} /></section>
    <button className="rounded-lg border border-slate-600 px-4 py-2" onClick={onReset}>Chọn file khác</button>
  </div>;
}
