import type { ImportIssue } from "../../domain/import/import";
export function ImportIssueList({ issues }: { readonly issues: readonly ImportIssue[] }) {
  if (!issues.length) return <p className="text-emerald-400">Không phát hiện vấn đề.</p>;
  return <div className="space-y-2">{issues.map((issue, index) =>
    <div key={`${issue.code}-${issue.rowNumber ?? 0}-${index}`} className="rounded border border-slate-700 bg-slate-900 p-3 text-sm">
      <span className="mr-2 font-bold">{issue.severity}</span>
      <span>{issue.section}{issue.rowNumber ? ` · dòng ${issue.rowNumber}` : ""}{issue.field ? ` · ${issue.field}` : ""}</span>
      <p className="mt-1 text-slate-300">{issue.message}</p>
    </div>)}</div>;
}
