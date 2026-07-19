import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AccountService } from "../../application/accounts/AccountService";
import { ListTradesService } from "../../application/trades/ListTradesService";
import type { Account } from "../../domain/accounts/account";
import type { Trade, TradePage, TradeSide } from "../../domain/trades/trade";
import { SqlAccountRepository } from "../../infrastructure/database/repositories/SqlAccountRepository";
import { SqlTradeRepository } from "../../infrastructure/database/repositories/SqlTradeRepository";

const PAGE_SIZE = 50;
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000); if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} giờ ${minutes % 60} phút`;
  return `${Math.floor(hours / 24)} ngày ${hours % 24} giờ`;
}
function TradeRow({ trade, timezone, mobile = false }: {
  readonly trade: Trade; readonly timezone: string; readonly mobile?: boolean;
}) {
  const pnl = trade.netProfit.startsWith("-") ? "text-rose-400" : trade.netProfit === "0" ? "text-slate-300" : "text-emerald-400";
  const closed = new Intl.DateTimeFormat("vi-VN", { timeZone: timezone, dateStyle: "short", timeStyle: "medium" }).format(new Date(trade.closedAt));
  const sideClass = trade.side === "BUY"
    ? "border-cyan-500/40 bg-cyan-950/50 text-cyan-300"
    : "border-amber-500/40 bg-amber-950/50 text-amber-300";
  if (!mobile) return <tr className="border-t border-slate-800 bg-slate-900/70">
      <td className="px-3 py-3 text-left whitespace-nowrap">{closed}</td>
      <td className="px-3 py-3 text-left font-semibold">{trade.symbol}</td>
      <td className="px-3 py-3 text-center"><span className={`rounded border px-2 py-1 text-xs font-bold ${sideClass}`}>{trade.side}</span></td>
      {[trade.volume, trade.openPrice, trade.closePrice, trade.commission, trade.swap, trade.grossProfit].map((value, index) =>
        <td key={index} className="px-3 py-3 text-right font-mono tabular-nums">{value}</td>)}
      <td className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${pnl}`}>{trade.netProfit}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap">{formatDuration(trade.durationMs)}</td>
    </tr>;
  return <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-bold">{trade.symbol}
        <span className={`rounded border px-2 py-1 text-xs ${sideClass}`}>{trade.side}</span></h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {[
          ["Đóng lúc", closed], ["Khối lượng", trade.volume], ["Giá mở", trade.openPrice],
          ["Giá đóng", trade.closePrice], ["Phí", trade.commission], ["Swap", trade.swap],
          ["Lãi gộp", trade.grossProfit], ["Lãi ròng", trade.netProfit],
          ["Thời lượng", formatDuration(trade.durationMs)],
        ].map(([label, value]) => <div className="contents" key={label}>
          <dt className="text-slate-400">{label}</dt>
          <dd className={`text-right font-mono tabular-nums ${label === "Lãi ròng" ? pnl : ""}`}>{value}</dd>
        </div>)}
      </dl>
    </article>;
}
interface Props {
  readonly accountService?: Pick<AccountService, "list">;
  readonly tradeService?: Pick<ListTradesService, "execute">;
}
export function TradesScreen({ accountService: suppliedAccounts, tradeService: suppliedTrades }: Props = {}) {
  const accountService = useMemo(() => suppliedAccounts ?? new AccountService(new SqlAccountRepository()), [suppliedAccounts]);
  const tradeService = useMemo(() => suppliedTrades ?? new ListTradesService(new SqlTradeRepository()), [suppliedTrades]);
  const [accounts, setAccounts] = useState<Account[]>([]); const [accountId, setAccountId] = useState("");
  const [draftSymbol, setDraftSymbol] = useState(""); const [draftSide, setDraftSide] = useState<"" | TradeSide>("");
  const [appliedFilters, setAppliedFilters] = useState<{ symbol: string; side: "" | TradeSide }>({ symbol: "", side: "" });
  const [page, setPage] = useState<TradePage | null>(null); const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState<"accounts" | "trades" | "">("");
  const requestSequence = useRef(0);
  const appliedFiltersRef = useRef(appliedFilters);
  const filterSubmitInFlight = useRef(false);
  const loadAccounts = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [active, archived] = await Promise.all([accountService.list("active"), accountService.list("archived")]);
      const rows = [...active, ...archived]; setAccounts(rows); setAccountId(rows[0]?.id ?? "");
    } catch { setError("accounts"); } finally { setLoading(false); }
  }, [accountService]);
  useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  const loadTrades = useCallback(async (
    targetAccountId: string,
    filters: { symbol: string; side: "" | TradeSide },
    offset = 0,
    append = false,
  ) => {
    if (!targetAccountId) return;
    const sequence = ++requestSequence.current;
    append ? setLoadingMore(true) : setLoading(true); setError("");
    try {
      const result = await tradeService.execute({ accountId: targetAccountId, limit: PAGE_SIZE, offset,
        symbol: filters.symbol || undefined, side: filters.side || undefined });
      if (sequence !== requestSequence.current) return;
      setPage((current) => append && current ? { ...result, items: [...current.items, ...result.items] } : result);
    } catch { if (sequence === requestSequence.current) setError("trades"); }
    finally {
      if (sequence === requestSequence.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [tradeService]);
  useEffect(() => {
    requestSequence.current += 1; setPage(null);
    if (accountId) void loadTrades(accountId, appliedFiltersRef.current);
  }, [accountId, loadTrades]);
  const handleApplyFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (filterSubmitInFlight.current || loading || loadingMore) return;
    filterSubmitInFlight.current = true;
    const next = { symbol: draftSymbol.trim(), side: draftSide };
    appliedFiltersRef.current = next; setAppliedFilters(next); setPage(null);
    requestSequence.current += 1;
    try { await loadTrades(accountId, next); }
    finally { filterSubmitInFlight.current = false; }
  };
  const handleClearFilters = async () => {
    if (filterSubmitInFlight.current || loading || loadingMore) return;
    filterSubmitInFlight.current = true;
    const empty = { symbol: "", side: "" as const };
    setDraftSymbol(""); setDraftSide(""); appliedFiltersRef.current = empty;
    setAppliedFilters(empty); setPage(null); requestSequence.current += 1;
    try { await loadTrades(accountId, empty); }
    finally { filterSubmitInFlight.current = false; }
  };
  const selected = accounts.find((account) => account.id === accountId);
  if (loading && !accounts.length) return <div className="p-8" role="status">Đang tải giao dịch…</div>;
  if (error) return <div className="p-8"><p role="alert">{error === "accounts" ? "Không thể tải tài khoản." : "Không thể tải danh sách giao dịch."}</p>
    <button onClick={() => error === "accounts" ? void loadAccounts() : void loadTrades(accountId, appliedFilters)}>Thử lại</button></div>;
  if (!accounts.length) return <div className="p-8"><p>Chưa có tài khoản để xem giao dịch.</p><Link to="/accounts">Tạo tài khoản</Link></div>;
  return <section className="space-y-5 p-5 md:p-8">
    <header><h1 className="text-3xl font-bold">Giao dịch</h1><p>{page?.total ?? 0} giao dịch · đang hiển thị {page?.items.length ?? 0}</p></header>
    {loading && <div role="status">Đang tải giao dịch…</div>}
    <form className="grid items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_10rem_auto]"
      onSubmit={(event) => void handleApplyFilters(event)}>
      <label className="grid gap-1 text-sm font-medium" htmlFor="trade-account">Tài khoản
        <select id="trade-account" className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.isArchived ? " (đã lưu trữ)" : ""}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium" htmlFor="trade-symbol">Symbol
        <input id="trade-symbol" className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          placeholder="Ví dụ: XAUUSD" value={draftSymbol} onChange={(event) => setDraftSymbol(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-medium" htmlFor="trade-side">Side
        <select id="trade-side" className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          value={draftSide} onChange={(event) => setDraftSide(event.target.value as "" | TradeSide)}><option value="">Tất cả</option><option value="BUY">Buy</option><option value="SELL">Sell</option></select></label>
      <div className="flex min-h-10 flex-wrap gap-2">
        <button type="submit" disabled={loading || loadingMore}
          className="min-h-10 cursor-pointer rounded-md border border-indigo-500 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 active:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">Lọc</button>
        {(appliedFilters.symbol || appliedFilters.side) && <button type="button" disabled={loading || loadingMore}
          onClick={() => void handleClearFilters()}
          className="min-h-10 cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50">Xóa lọc</button>}
      </div>
    </form>
    {!page?.items.length ? <div><p>{appliedFilters.symbol || appliedFilters.side ? "Không tìm thấy giao dịch phù hợp." : "Chưa có giao dịch nào. Hãy nhập báo cáo MT5 để bắt đầu."}</p><Link to="/import">Nhập báo cáo MT5</Link></div>
      : <div aria-label="Danh sách giao dịch">
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400"><tr>
            {["Đóng lúc", "Mã", "Lệnh", "Khối lượng", "Giá mở", "Giá đóng", "Phí", "Swap", "Lãi gộp", "Lãi ròng", "Thời lượng"].map((heading, index) =>
              <th key={heading} scope="col" className={`px-3 py-3 ${index < 2 ? "text-left" : index === 2 ? "text-center" : "text-right"}`}>{heading}</th>)}
          </tr></thead><tbody>{page.items.map((item) => <TradeRow key={item.id} trade={item} timezone={selected?.timezone ?? "UTC"} />)}</tbody>
        </table></div>
        <div className="space-y-3 md:hidden">{page.items.map((item) => <TradeRow mobile key={item.id} trade={item} timezone={selected?.timezone ?? "UTC"} />)}</div>
      </div>}
    {page && page.items.length < page.total && <button disabled={loadingMore}
      onClick={() => void loadTrades(accountId, appliedFilters, page.items.length, true)}>{loadingMore ? "Đang tải thêm…" : "Tải thêm"}</button>}
  </section>;
}
