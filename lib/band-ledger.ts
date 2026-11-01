export const BAND_LEDGER_CATEGORIES = {
  opening_balance: "Opening balance", ticket_sales: "Ticket sales", merch_sales: "Merch sales",
  venue_payout: "Venue payout", expense: "Expense", member_payout: "Member payout",
  deposit: "Deposit", venmo: "Venmo", processing_fee: "Processing fee",
  refund: "Refund", transfer: "Transfer", other: "Other",
} as const;
export type BandLedgerCategory = keyof typeof BAND_LEDGER_CATEGORIES;
export type BandLedgerEntry = {
  id: string; sequence: number; entry_date: string; payee: string;
  category: BandLedgerCategory; show_id: string | null; show_label: string | null;
  memo: string | null; payment: number | string; deposit: number | string;
  created_at: string; voided_at: string | null; void_reason: string | null;
};
export type LedgerShow = { id: string; show_name: string | null; show_date: string };
export const amountCents = (value: number | string) => Math.round(Number(value) * 100);
export function showLabel(show: LedgerShow) {
  return show.show_date + " · " + (show.show_name || "Pocket Fuzz show");
}
export function parseBandLedgerEntry(form: FormData) {
  const entry_date = String(form.get("entry_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date) || !Number.isFinite(Date.parse(entry_date + "T12:00:00Z")) ||
      new Date(entry_date + "T12:00:00Z").toISOString().slice(0, 10) !== entry_date) {
    throw new Error("Enter a valid transaction date.");
  }
  const payee = String(form.get("payee") ?? "").trim();
  const memo = String(form.get("memo") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const show_id = String(form.get("show_id") ?? "").trim();
  if (!payee || payee.length > 300) throw new Error("Enter a payee, up to 300 characters.");
  if (memo.length > 2000) throw new Error("Memo must be 2,000 characters or fewer.");
  if (!Object.hasOwn(BAND_LEDGER_CATEGORIES, category)) throw new Error("Choose a valid category.");
  if (show_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(show_id)) {
    throw new Error("Choose a show from the show list.");
  }
  function amount(key: string) {
    const raw = String(form.get(key) ?? "").trim();
    if (!raw) return 0;
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw)) throw new Error("Amounts must be nonnegative dollars with at most two decimal places.");
    return Number(raw);
  }
  const payment = amount("payment"); const deposit = amount("deposit");
  if ((payment > 0) === (deposit > 0)) throw new Error("Enter either a payment or a deposit, not both.");
  return { entry_date, payee, category: category as BandLedgerCategory, show_id: show_id || null,
    memo: memo || null, payment, deposit };
}
export function bandLedgerRegister(entries: BandLedgerEntry[], shows: LedgerShow[] = []) {
  const showById = new Map(shows.map(s => [s.id, showLabel(s)]));
  let balance = 0; let payments = 0; let deposits = 0;
  const rows = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.sequence - b.sequence || a.id.localeCompare(b.id))
    .map(entry => {
      const paymentCents = amountCents(entry.payment); const depositCents = amountCents(entry.deposit);
      if (!entry.voided_at) {
        payments += paymentCents; deposits += depositCents; balance += depositCents - paymentCents;
      }
      return { ...entry, paymentCents, depositCents, balance,
        showName: (entry.show_id && showById.get(entry.show_id)) || entry.show_label || "" };
    });
  return { rows, balance, payments, deposits };
}
export type BandLedgerRow = ReturnType<typeof bandLedgerRegister>["rows"][number];
export function bandLedgerCsv(rows: BandLedgerRow[]) {
  const cell = (value: string) => {
    const safe = /^[=+@\-]/.test(value.trimStart()) ? "'" + value : value;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return [
    ["Date", "Payee", "Category", "Show", "Memo", "Payment", "Deposit", "Balance", "Voided", "Void reason"],
    ...rows.map(r => [r.entry_date, r.payee, BAND_LEDGER_CATEGORIES[r.category], r.showName, r.memo || "",
      r.paymentCents ? (r.paymentCents / 100).toFixed(2) : "", r.depositCents ? (r.depositCents / 100).toFixed(2) : "",
      (r.balance / 100).toFixed(2), r.voided_at ? "yes" : "no", r.void_reason || ""]),
  ].map(row => row.map(cell).join(",")).join("\r\n");
}
