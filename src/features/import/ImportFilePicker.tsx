import { MAX_IMPORT_BYTES } from "../../application/import/ImportPreviewService";
export function ImportFilePicker({ disabled, onSelect }: {
  readonly disabled: boolean; readonly onSelect: (file: File) => void;
}) {
  return <label className="block rounded-xl border border-dashed border-slate-600 p-8 text-center">
    <span className="block font-semibold">Chọn Vantage MT5 Trade History CSV</span>
    <span className="mt-1 block text-sm text-slate-400">Tối đa {MAX_IMPORT_BYTES / 1024 / 1024} MB, chỉ xử lý cục bộ.</span>
    <input className="mt-4" type="file" accept=".csv,text/csv" disabled={disabled}
      onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onSelect(file); }} />
  </label>;
}
