export const LEDGER_CATEGORIES = {
  ticket_receipt: "Ticket receipt", merch_receipt: "Merch receipt",
  venue_settlement: "Venue settlement", other_income: "Other receipt",
  spending: "Spending", processing_fee: "Processing fee", refund: "Refund",
  bank_deposit: "Bank deposit", account_transfer: "Account transfer",
} as const;
export type LedgerCategory = keyof typeof LEDGER_CATEGORIES;
export const LEDGER_DIRECTIONS: Record<LedgerCategory, "in" | "out" | "transfer"> = {
  ticket_receipt: "in", merch_receipt: "in", venue_settlement: "in", other_income: "in",
  spending: "out", processing_fee: "out", refund: "out",
  bank_deposit: "transfer", account_transfer: "transfer",
};
export type ManualLedgerEntry = {
  id: string; entry_date: string; category: LedgerCategory; amount: number | string;
  account: string; to_account: string | null; description: string;
  reference: string | null; notes: string | null; created_at: string;
  voided_at: string | null; void_reason: string | null;
};
export type LedgerRow = {
  id: string; date: string; description: string; category: string;
  account: string; reference: string; direction: "in" | "out" | "transfer";
  cents: number; source: "manual" | "expense" | "payout" | "venmo";
  href: string | null; voided: boolean; notes: string;
};
export const cents = (value: number | string) => Math.round(Number(value) * 100);

export function parseLedgerEntry(form: FormData) {
  const category = String(form.get("category") ?? "");
  if (!Object.hasOwn(LEDGER_CATEGORIES, category)) throw new Error("Choose a valid ledger category.");
  const entry_date = String(form.get("entry_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date) ||
      !Number.isFinite(Date.parse(entry_date + "T12:00:00Z")) ||
      new Date(entry_date + "T12:00:00Z").toISOString().slice(0, 10) !== entry_date) {
    throw new Error("Enter a valid entry date.");
  }
  const rawAmount = String(form.get("amount") ?? "").trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(rawAmount) || Number(rawAmount) <= 0) {
    throw new Error("Enter a positive amount with at most two decimal places.");
  }
  const account = String(form.get("account") ?? "").trim();
  const to_account = String(form.get("to_account") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const reference = String(form.get("reference") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();
  if (!account || !description || account.length > 120 || description.length > 300 ||
      to_account.length > 120 || reference.length > 200 || notes.length > 2000) {
    throw new Error("Enter an account and description within the field limits.");
  }
  const transfer = LEDGER_DIRECTIONS[category as LedgerCategory] === "transfer";
  if (transfer && (!to_account || account.toLowerCase() === to_account.toLowerCase())) {
    throw new Error("Transfers need different source and destination accounts.");
  }
  return { entry_date, category: category as LedgerCategory, amount: Number(rawAmount),
    account, to_account: transfer ? to_account : null, description,
    reference: reference || null, notes: notes || null };
}

function mountainDay(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function ledgerCsv(rows: (LedgerRow & { balance: number })[]): string {
  const cell = (value: string) => {
    const safe = /^[=+@\-\t\r\n]/.test(value.trimStart()) ? "'" + value : value;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const header = ["Date", "Category", "Description", "Account", "Reference", "Movement", "Amount USD", "Running net USD", "Source", "Voided", "Notes"];
  return [header, ...rows.map(r => [r.date, r.category, r.description, r.account, r.reference,
    r.direction, (r.cents / 100).toFixed(2), (r.balance / 100).toFixed(2), r.source, r.voided ? "yes" : "no", r.notes])]
    .map(row => row.map(cell).join(",")).join("\r\n");
}

type Expense = { id: string; category: string; description: string | null;
  actual_amount: number | string; payment_method: string | null; paid_by: string | null; created_at: string };
type Payout = { id: string; member_name: string; amount: number | string; paid: boolean; paid_at: string | null; created_at: string };
type Order = { id: string; order_number: string; expected_amount: number | string;
  status: string; reviewed_at: string | null; created_at: string };
export function buildShowLedger(input: {
  showId: string; manual: ManualLedgerEntry[]; expenses: Expense[]; payouts: Payout[]; orders: Order[];
}) {
  const showHref = "/admin/shows/" + input.showId;
  const rows: LedgerRow[] = input.manual.map(e => ({
    id: "manual:" + e.id, date: e.entry_date, description: e.description,
    category: LEDGER_CATEGORIES[e.category], account: e.to_account ? e.account + " → " + e.to_account : e.account,
    reference: e.reference ?? "", direction: LEDGER_DIRECTIONS[e.category], cents: cents(e.amount),
    source: "manual", href: null, voided: Boolean(e.voided_at),
    notes: e.voided_at ? "Voided: " + (e.void_reason ?? "") : e.notes ?? "",
  }));
  for (const e of input.expenses) {
    if (cents(e.actual_amount) <= 0) continue;
    rows.push({ id: "expense:" + e.id, date: mountainDay(e.created_at),
      description: e.description || e.category, category: "Recorded show expense",
      account: e.payment_method || "Unspecified", reference: e.paid_by ? "Paid by " + e.paid_by : "",
      direction: "out", cents: cents(e.actual_amount), source: "expense",
      href: showHref + "#show-expenses", voided: false, notes: "Recorded actual cost; verify payment against your account statement." });
  }
  for (const p of input.payouts) {
    if (!p.paid || cents(p.amount) <= 0) continue;
    rows.push({ id: "payout:" + p.id, date: mountainDay(p.paid_at || p.created_at),
      description: "Member payout: " + p.member_name, category: "Paid member payout",
      account: "Unspecified", reference: "", direction: "out", cents: cents(p.amount),
      source: "payout", href: showHref + "#member-payouts", voided: false, notes: "" });
  }
  for (const o of input.orders) {
    if (o.status !== "approved") continue;
    rows.push({ id: "venmo:" + o.id, date: mountainDay(o.reviewed_at || o.created_at),
      description: "Approved Venmo order " + o.order_number, category: "Venmo receipt (gross)",
      account: "Venmo", reference: o.order_number, direction: "in", cents: cents(o.expected_amount),
      source: "venmo", href: "/admin/venmo?status=approved", voided: false,
      notes: "Includes customer service fee. Record actual processor fees separately; ticket and merch totals are not added again." });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let balance = 0; let received = 0; let spent = 0; let transferred = 0;
  const activity = rows.map(row => {
    if (!row.voided) {
      if (row.direction === "in") { received += row.cents; balance += row.cents; }
      else if (row.direction === "out") { spent += row.cents; balance -= row.cents; }
      else transferred += row.cents;
    }
    return { ...row, balance };
  });
  return { rows: activity, received, spent, transferred, balance };
}
