import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    void error;
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void error;
    void errorInfo;
    console.error("UNCAUGHT_UI_ERROR");
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 bg-slate-800 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <h1 className="text-xl font-bold text-slate-200 mb-2">Đã Xảy Ra Lỗi Giao Diện</h1>
              <p className="text-slate-400 text-sm mb-6">
                Ứng dụng gặp một lỗi giao diện đột ngột. Hãy thử tải lại trang hoặc liên hệ hỗ trợ.
              </p>

              <button
                onClick={this.handleReload}
                type="button"
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                Tải Lại Giao Diện
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
