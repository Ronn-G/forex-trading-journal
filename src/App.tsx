import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "./app/shell/ErrorBoundary";
import { InitializationFailureScreen } from "./app/shell/InitializationFailureScreen";
import { router } from "./app/router";
import { getDatabaseConnection } from "./infrastructure/database/client";
import { runMigrations } from "./infrastructure/database/migrator";

export function App() {
  const [initError, setInitError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const initializeApp = async () => {
    setLoading(true);
    setInitError(null);
    try {
      // 1. Kết nối cơ sở dữ liệu SQLite
      const db = await getDatabaseConnection();
      
      // 2. Chạy migration tự động
      await runMigrations(db);

      // 3. Backfill Story 5 CLOSED positions only after migration 0005 exists.
      await invoke<number>("backfill_missing_trades");
    } catch (error) {
      console.error("APP_INITIALIZATION_FAILED");
      setInitError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          <p className="text-slate-400 text-sm font-medium">Đang khởi tạo hệ thống...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <InitializationFailureScreen
        onRetry={initializeApp}
      />
    );
  }

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

export default App;
