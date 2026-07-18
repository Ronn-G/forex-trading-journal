import { useEffect, useState } from "react";
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
    } catch (error) {
      console.error("Failed to initialize application:", error);
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
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          <p className="text-slate-400 text-sm font-medium">Đang khởi tạo hệ thống...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <InitializationFailureScreen
        error={initError}
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
