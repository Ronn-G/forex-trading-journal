import React from "react";

interface InitializationFailureScreenProps {
  onRetry: () => void;
}

export const InitializationFailureScreen: React.FC<InitializationFailureScreenProps> = ({
  onRetry,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-red-900/50 rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-red-950 border border-red-500/30 rounded-full flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-red-500 mb-2">Khởi Tạo Thất Bại</h1>
          <p className="text-slate-400 text-sm mb-6">
            Hệ thống không thể tải cơ sở dữ liệu cục bộ hoặc khởi chạy các tệp migration.
          </p>
          
          <p role="alert" className="mb-6 rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            Không thể mở cơ sở dữ liệu. Hãy đóng và mở lại ứng dụng, hoặc thử lại.
          </p>
          
          <button
            onClick={onRetry}
            type="button"
            className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Thử Lại
          </button>
        </div>
      </div>
    </div>
  );
};
