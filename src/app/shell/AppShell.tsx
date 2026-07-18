import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

export const AppShell: React.FC = () => {
  const location = useLocation();

  const navigation = [
    { name: "Trạng Thái", href: "/health", icon: "activity", active: location.pathname === "/health" },
    { name: "Tài Khoản", href: "/accounts", icon: "wallet", active: location.pathname === "/accounts" },
    { name: "Nhập MT5", href: "/import", icon: "trending-up", active: location.pathname === "/import" },
    { name: "Giao Dịch", href: "#", icon: "trending-up", disabled: true },
    { name: "Thiết Lập Setup", href: "#", icon: "layers", disabled: true },
    { name: "Phân Tích", href: "#", icon: "bar-chart-2", disabled: true },
    { name: "Cài Đặt", href: "#", icon: "settings", disabled: true },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo / Brand */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              FX Journal
            </span>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-1">
            {navigation.map((item) => (
              <React.Fragment key={item.name}>
                {item.disabled ? (
                  <div
                    className="flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium text-slate-650 cursor-not-allowed group"
                    title="Sắp ra mắt ở các Sprint tiếp theo"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-700">{renderIcon(item.icon)}</span>
                      <span className="text-slate-500">{item.name}</span>
                    </div>
                    <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-600 font-semibold uppercase tracking-wider scale-90 opacity-0 group-hover:opacity-100 transition-opacity">
                      Soon
                    </span>
                  </div>
                ) : (
                  <Link
                    to={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      item.active
                        ? "bg-indigo-600/20 border border-indigo-500/20 text-indigo-400"
                        : "text-slate-400 hover:bg-slate-850 hover:text-slate-200"
                    }`}
                  >
                    <span>{renderIcon(item.icon, item.active ? "text-indigo-400" : "text-slate-400")}</span>
                    <span>{item.name}</span>
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* User / Build info at bottom */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700">
              TR
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-300 truncate">Local Trader</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">v0.1.0 (Sprint 1)</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-indigo-950 border border-indigo-500/20 text-indigo-400 font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Sprint 1 - Accounts
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Offline Mode</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Helper để render inline SVG icon đơn giản tránh thêm icon library lớn
function renderIcon(name: string, className = "text-current") {
  const baseSvg = "h-4 w-4 " + className;
  switch (name) {
    case "activity":
      return (
        <svg className={baseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"
          />
        </svg>
      );
    case "wallet":
      return (
        <svg className={baseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
      );
    case "trending-up":
      return (
        <svg className={baseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case "layers":
      return (
        <svg className={baseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      );
    case "bar-chart-2":
      return (
        <svg className={baseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case "settings":
      return (
        <svg className={baseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return null;
  }
}
