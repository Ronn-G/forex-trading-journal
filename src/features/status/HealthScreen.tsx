import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MigrationRepository, AppliedMigration } from "../../infrastructure/database/repositories/MigrationRepository";

interface AppPaths {
  app_data_dir: string;
  database_dir: string;
  images_dir: string;
  backups_dir: string;
  imports_dir: string;
  logs_dir: string;
}

export const HealthScreen: React.FC = () => {
  const [paths, setPaths] = useState<AppPaths | null>(null);
  const [migrations, setMigrations] = useState<AppliedMigration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHealthData() {
      try {
        // 1. Lấy thông tin app paths từ Rust command
        const appPaths = await invoke<AppPaths>("get_app_paths");
        setPaths(appPaths);

        // 2. Lấy thông tin migrations từ Repository
        const repo = new MigrationRepository();
        const applied = await repo.getAppliedMigrations();
        setMigrations(applied);
      } catch (err) {
        console.error("Failed to load health data:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    loadHealthData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          <p className="text-slate-400 text-sm">Đang tải thông tin hệ thống...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto text-slate-100">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          Trạng Thái Hệ Thống
        </h1>
        <p className="text-slate-400 mt-2">
          Tổng quan trạng thái kỹ thuật và dữ liệu của Forex Trading Journal.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-500/20 rounded-lg text-red-400 text-sm flex gap-3">
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <span className="font-bold">Lỗi:</span> {error}
          </div>
        </div>
      )}

      {/* Grid Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Kết nối DB & Migrations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Cơ Sở Dữ Liệu (SQLite)
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Trạng thái:</span>
              <span className="text-emerald-400 font-medium">Đã kết nối</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Foreign Keys:</span>
              <span className="text-slate-300 font-mono">ON (Kích hoạt)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Phiên bản schema:</span>
              <span className="text-indigo-400 font-mono font-bold">
                {migrations.length > 0 ? migrations[migrations.length - 1].version : "Không có"}
              </span>
            </div>
          </div>
        </div>

        {/* Cấu hình App directories */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            Ứng Dụng (Tauri v2)
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Phiên bản app:</span>
              <span className="text-slate-300">0.1.0 (Sprint 0)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Chế độ hoạt động:</span>
              <span className="text-emerald-400">Offline (Local-first)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Môi trường:</span>
              <span className="text-slate-300 font-mono text-xs">Windows</span>
            </div>
          </div>
        </div>
      </div>

      {/* App Data Directories Paths */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Đường Dẫn Dữ Liệu</h2>
        {paths && (
          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded border border-slate-850 flex flex-col gap-1">
              <span className="text-indigo-400 font-bold">Thư mục gốc ứng dụng (AppData/Local):</span>
              <span className="text-slate-300 select-all break-all">{paths.app_data_dir}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded border border-slate-850 flex flex-col gap-1">
              <span className="text-indigo-400 font-bold">Thư mục Cơ sở dữ liệu:</span>
              <span className="text-slate-300 select-all break-all">{paths.database_dir}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded border border-slate-850 flex flex-col gap-1">
              <span className="text-indigo-400 font-bold">Thư mục hình ảnh:</span>
              <span className="text-slate-300 select-all break-all">{paths.images_dir}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded border border-slate-850 flex flex-col gap-1">
              <span className="text-indigo-400 font-bold">Thư mục log:</span>
              <span className="text-slate-300 select-all break-all">{paths.logs_dir}</span>
            </div>
          </div>
        )}
      </div>

      {/* Applied Migrations List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Lịch Sử Migration</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300 font-normal">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950 font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Version</th>
                <th className="px-4 py-3">Tên Migration</th>
                <th className="px-4 py-3 font-mono">Checksum SHA-256</th>
                <th className="px-4 py-3 rounded-r-lg">Ngày Áp Dụng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {migrations.map(m => (
                <tr key={m.version} className="hover:bg-slate-850/30">
                  <td className="px-4 py-3 font-bold text-indigo-400">{m.version}</td>
                  <td className="px-4 py-3 text-slate-200">{m.name}</td>
                  <td
                    className="px-4 py-3 font-mono text-xs text-slate-400 truncate max-w-[150px]"
                    title={m.checksum}
                  >
                    {m.checksum.substring(0, 12)}...
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(m.applied_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {migrations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Chưa có migration nào được áp dụng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
