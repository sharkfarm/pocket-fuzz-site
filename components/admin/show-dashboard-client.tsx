"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ShowSummary = {
  show_id: string;
  show_name: string | null;
  show_date: string;
  status: string;
  venue_name: string | null;
  capacity: number;
  ticket_goal: number | null;
  tickets_sold: number;
  gross_ticket_sales: number | string;
  ticket_payout: number | string;
  net_show_profit: number | string;
  merch_profit: number | string;
  total_expenses: number | string;
  capacity_percent: number | string;
};

type Props = {
  shows: ShowSummary[];
  outstandingReimbursements: number;
};

const statuses = ["all", "draft", "upcoming", "completed", "cancelled"] as const;

export default function ShowDashboardClient({ shows, outstandingReimbursements }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [view, setView] = useState<"list" | "calendar">("list");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return shows.filter((show) => {
      const matchesStatus = status === "all" || show.status === status;
      const matchesQuery =
        !needle ||
        (show.show_name ?? "").toLowerCase().includes(needle) ||
        (show.venue_name ?? "").toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [query, shows, status]);

  const upcoming = shows.filter((show) => show.status === "upcoming");
  const completed = shows.filter((show) => show.status === "completed");
  const upcomingTickets = upcoming.reduce((sum, show) => sum + Number(show.tickets_sold), 0);
  const projectedPayout = upcoming.reduce((sum, show) => sum + Number(show.ticket_payout), 0);
  const completedProfit = completed.reduce((sum, show) => sum + Number(show.net_show_profit), 0);
  const totalGross = completed.reduce((sum, show) => sum + Number(show.gross_ticket_sales), 0);

  const chartData = [...completed]
    .sort((a, b) => a.show_date.localeCompare(b.show_date))
    .slice(-8);
  const maxProfit = Math.max(1, ...chartData.map((show) => Math.max(0, Number(show.net_show_profit))));

  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Upcoming Shows" value={String(upcoming.length)} />
        <Kpi label="Upcoming Tickets" value={String(upcomingTickets)} />
        <Kpi label="Projected Payout" value={money(projectedPayout)} />
        <Kpi label="Completed Profit" value={money(completedProfit)} />
        <Kpi
          label="Outstanding Reimbursements"
          value={money(outstandingReimbursements)}
          warning={outstandingReimbursements > 0}
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black uppercase">Profit by Show</h2>
              <p className="mt-1 text-sm text-stone-500">Last {chartData.length || 0} completed shows</p>
            </div>
            <p className="text-right text-sm text-stone-400">
              Gross<br /><strong className="text-stone-100">{money(totalGross)}</strong>
            </p>
          </div>
          {chartData.length === 0 ? (
            <p className="mt-10 text-sm text-stone-500">Complete a show to populate this chart.</p>
          ) : (
            <div className="mt-8 flex h-52 items-end gap-2 sm:gap-4">
              {chartData.map((show) => {
                const value = Math.max(0, Number(show.net_show_profit));
                const height = Math.max(6, Math.round((value / maxProfit) * 100));
                return (
                  <div key={show.show_id} className="group flex min-w-0 flex-1 flex-col items-center justify-end">
                    <span className="mb-2 hidden text-xs font-bold text-stone-300 group-hover:block">
                      {money(value)}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-red-600 transition hover:bg-red-500"
                      style={{ height: `${height}%` }}
                      title={`${show.show_name ?? "Show"}: ${money(value)}`}
                    />
                    <span className="mt-2 w-full truncate text-center text-[10px] uppercase text-stone-500">
                      {shortDate(show.show_date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5 sm:p-6">
          <h2 className="text-lg font-black uppercase">Performance Snapshot</h2>
          <div className="mt-6 space-y-5">
            <StatRow label="Average attendance" value={average(completed.map((s) => Number(s.tickets_sold))).toFixed(0)} />
            <StatRow label="Average ticket gross" value={money(average(completed.map((s) => Number(s.gross_ticket_sales))))} />
            <StatRow label="Average net profit" value={money(average(completed.map((s) => Number(s.net_show_profit))))} />
            <StatRow label="Merch profit" value={money(completed.reduce((sum, s) => sum + Number(s.merch_profit), 0))} />
          </div>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
        <div className="border-b border-stone-800 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black uppercase">Shows</h2>
              <p className="mt-1 text-sm text-stone-500">Search, filter, and track progress toward each goal.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search show or venue"
                className="rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 text-sm outline-none focus:border-red-500"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}
                className="rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 text-sm outline-none focus:border-red-500"
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>{item === "all" ? "All statuses" : capitalize(item)}</option>
                ))}
              </select>
              <div className="flex rounded-lg border border-stone-700 p-1">
                <ViewButton active={view === "list"} onClick={() => setView("list")}>List</ViewButton>
                <ViewButton active={view === "calendar"} onClick={() => setView("calendar")}>Calendar</ViewButton>
              </div>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-500">No shows match your filters.</div>
        ) : view === "list" ? (
          <div className="divide-y divide-stone-800">
            {filtered.map((show) => <ShowCard key={show.show_id} show={show} />)}
          </div>
        ) : (
          <CalendarGrid shows={filtered} />
        )}
      </section>
    </>
  );
}

function ShowCard({ show }: { show: ShowSummary }) {
  const goal = Math.max(1, Number(show.ticket_goal || show.capacity || 1));
  const percent = Math.min(100, Math.round((Number(show.tickets_sold) / goal) * 100));
  return (
    <article className="p-4 transition hover:bg-stone-800/40 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/admin/shows/${show.show_id}`} className="truncate text-lg font-black hover:text-red-400">
              {show.show_name || "Untitled Show"}
            </Link>
            <StatusBadge status={show.status} />
          </div>
          <p className="mt-1 text-sm text-stone-400">{show.venue_name || "Venue not set"} · {longDate(show.show_date)}</p>
          <div className="mt-4 max-w-xl">
            <div className="mb-2 flex justify-between text-xs font-bold uppercase text-stone-500">
              <span>{show.tickets_sold} sold</span><span>{percent}% of {goal} goal</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-800">
              <div className="h-full rounded-full bg-red-600" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
          <MiniMetric label="Gross" value={money(Number(show.gross_ticket_sales))} />
          <MiniMetric label="Payout" value={money(Number(show.ticket_payout))} />
          <MiniMetric label="Net" value={money(Number(show.net_show_profit))} />
          <Link href={`/admin/shows/${show.show_id}`} className="flex items-center justify-center rounded-lg bg-red-600 px-4 py-3 text-sm font-black uppercase hover:bg-red-500">Open</Link>
        </div>
      </div>
    </article>
  );
}

function CalendarGrid({ shows }: { shows: ShowSummary[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, ShowSummary[]>();
    for (const show of shows) {
      const key = show.show_date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), show]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shows]);
  return (
    <div className="space-y-8 p-4 sm:p-6">
      {grouped.map(([month, monthShows]) => (
        <section key={month}>
          <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-stone-400">{monthName(month)}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {monthShows.sort((a,b) => a.show_date.localeCompare(b.show_date)).map((show) => (
              <Link key={show.show_id} href={`/admin/shows/${show.show_id}`} className="rounded-xl border border-stone-800 bg-stone-950 p-4 hover:border-red-700">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-2xl font-black">{dayNumber(show.show_date)}</p><p className="text-xs uppercase text-stone-500">{weekday(show.show_date)}</p></div>
                  <StatusBadge status={show.status} />
                </div>
                <p className="mt-4 font-black">{show.show_name || "Untitled Show"}</p>
                <p className="mt-1 text-sm text-stone-500">{show.venue_name || "Venue not set"}</p>
                <p className="mt-4 text-sm font-bold text-red-400">{show.tickets_sold} tickets · {money(Number(show.ticket_payout))} payout</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Kpi({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`rounded-xl border p-5 ${warning ? "border-amber-800 bg-amber-950/30" : "border-stone-800 bg-stone-900"}`}><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p><p className={`mt-3 text-2xl font-black ${warning ? "text-amber-300" : ""}`}>{value}</p></div>;
}
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-stone-950 p-3"><p className="text-[10px] font-bold uppercase text-stone-500">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function StatRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-stone-800 pb-4 last:border-0"><span className="text-stone-400">{label}</span><strong>{value}</strong></div>; }
function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-md px-3 py-2 text-sm font-bold ${active ? "bg-stone-700 text-white" : "text-stone-500 hover:text-white"}`}>{children}</button>; }
function StatusBadge({ status }: { status: string }) { const classes: Record<string,string> = { upcoming:"border-blue-800 bg-blue-950/40 text-blue-300", completed:"border-emerald-800 bg-emerald-950/40 text-emerald-300", cancelled:"border-red-800 bg-red-950/40 text-red-300", draft:"border-amber-800 bg-amber-950/40 text-amber-300" }; return <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${classes[status] ?? "border-stone-700 text-stone-400"}`}>{status}</span>; }
function average(values: number[]) { return values.length ? values.reduce((a,b) => a+b,0) / values.length : 0; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(value || 0); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function parseDate(value: string) { return new Date(`${value}T00:00:00Z`); }
function longDate(value: string) { return new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" }).format(parseDate(value)); }
function shortDate(value: string) { return new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", timeZone:"UTC" }).format(parseDate(value)); }
function dayNumber(value: string) { return new Intl.DateTimeFormat("en-US", { day:"numeric", timeZone:"UTC" }).format(parseDate(value)); }
function weekday(value: string) { return new Intl.DateTimeFormat("en-US", { weekday:"short", timeZone:"UTC" }).format(parseDate(value)); }
function monthName(value: string) { return new Intl.DateTimeFormat("en-US", { month:"long", year:"numeric", timeZone:"UTC" }).format(new Date(`${value}-01T00:00:00Z`)); }
