import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LiveTicketCalculator from "@/components/admin/live-ticket-calculator";
import {
  addExpense,
  addMerchSale,
  addShowPayment,
  deleteExpense,
  deleteMerchSale,
  deleteShowPayment,
  duplicateShow,
  toggleExpenseReimbursed,
  toggleShowPayment,
  updateExpense,
  updateMerchSale,
  updateShowDetails,
  updateShowSettlement,
  updateShowPayment,
  updateTicketSales,
} from "./actions";

type ShowDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

type TicketSale = {
  id: string;
  ticket_type: string;
  channel: string;
  ticket_price: number | string;
  projected_quantity: number;
  actual_quantity: number;
};

type Expense = {
  id: string;
  category: string;
  description: string | null;
  budget_amount: number | string;
  actual_amount: number | string;
  paid_by: string | null;
  payment_method: string | null;
  reimbursed: boolean;
  notes: string | null;
};

type MerchSale = {
  id: string;
  item_name: string;
  quantity_sold: number;
  unit_price: number | string;
  unit_cost: number | string;
  payment_method: string | null;
};

type ShowPayment = {
  id: string;
  member_name: string;
  amount: number | string;
  paid: boolean;
};

export default async function ShowDetailPage({
  params,
  searchParams,
}: ShowDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [
    { data: show, error: showError },
    { data: showDetails, error: showDetailsError },
    { data: ticketData, error: ticketError },
    { data: expenseData, error: expenseError },
    { data: merchData, error: merchError },
    { data: paymentData, error: paymentError },
  ] = await Promise.all([
    supabase
      .from("show_financial_summary")
      .select("*")
      .eq("show_id", id)
      .maybeSingle(),

    supabase
      .from("shows")
      .select(
        `
          id,
          show_name,
          show_date,
          doors_time,
          start_time,
          end_time,
          capacity,
          ticket_goal,
          number_of_acts,
          radius_clause_weeks,
          radius_clause_miles,
          food_discount_percent,
          meals_included_ticket_threshold,
          notes,
          venues (
            name
          )
        `
      )
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("ticket_sales")
      .select(
        `
          id,
          ticket_type,
          channel,
          ticket_price,
          projected_quantity,
          actual_quantity
        `
      )
      .eq("show_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("expenses")
      .select(
        `
          id,
          category,
          description,
          budget_amount,
          actual_amount,
          paid_by,
          payment_method,
          reimbursed,
          notes
        `
      )
      .eq("show_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("merch_sales")
      .select(
        `
          id,
          item_name,
          quantity_sold,
          unit_price,
          unit_cost,
          payment_method
        `
      )
      .eq("show_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("show_payments")
      .select("id, member_name, amount, paid")
      .eq("show_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (showError || !show) {
    notFound();
  }

  if (showDetailsError || !showDetails) {
    notFound();
  }

  const venueRelation = Array.isArray(showDetails.venues)
    ? showDetails.venues[0]
    : showDetails.venues;

  const editableVenueName = venueRelation?.name ?? "";

  const tickets = (ticketData ?? []) as TicketSale[];
  const expenses = (expenseData ?? []) as Expense[];
  const merchSales = (merchData ?? []) as MerchSale[];
  const showPayments = (paymentData ?? []) as ShowPayment[];

  const totalBudgetedExpenses = expenses.reduce(
    (total, expense) => total + Number(expense.budget_amount),
    0
  );

  const totalActualExpenses = expenses.reduce(
    (total, expense) => total + Number(expense.actual_amount),
    0
  );

  const unreimbursedExpenses = expenses
    .filter((expense) => !expense.reimbursed)
    .reduce(
      (total, expense) => total + Number(expense.actual_amount),
      0
    );

  const merchRevenue = merchSales.reduce(
    (total, item) =>
      total + Number(item.quantity_sold) * Number(item.unit_price),
    0
  );

  const merchCost = merchSales.reduce(
    (total, item) =>
      total + Number(item.quantity_sold) * Number(item.unit_cost),
    0
  );

  const merchProfit = merchRevenue - merchCost;
  const totalAssignedPayments = showPayments.reduce(
    (total, payment) => total + Number(payment.amount),
    0
  );
  const totalPaidPayments = showPayments
    .filter((payment) => payment.paid)
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const unassignedProfit = Number(show.net_show_profit) - totalAssignedPayments;

  const projectedTickets = tickets.reduce(
    (total, ticket) => total + Number(ticket.projected_quantity),
    0
  );

  const projectedGross = tickets.reduce(
    (total, ticket) =>
      total +
      Number(ticket.ticket_price) *
        Number(ticket.projected_quantity),
    0
  );

  const projectedPayoutRate = getPayoutRate(projectedTickets);
  const projectedPayout = projectedGross * projectedPayoutRate;

  const actualTickets = Number(show.tickets_sold);
  const capacity = Number(show.capacity);

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin/shows"
              className="text-sm font-bold text-stone-400 hover:text-white"
            >
              ← Back to Shows
            </Link>

            <p className="mt-7 text-xs font-bold uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz
            </p>

            <h1 className="mt-2 text-4xl font-black uppercase">
              {show.show_name || "Untitled Show"}
            </h1>

            <p className="mt-2 text-stone-400">
              {show.venue_name || "Venue not set"} ·{" "}
              {formatDate(show.show_date)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-fit rounded-full border border-stone-700 px-4 py-2 text-xs font-black uppercase tracking-wide">
              {show.status}
            </span>
            <form action={duplicateShow}>
              <input type="hidden" name="show_id" value={id} />
              <button
                type="submit"
                className="rounded-lg border border-stone-700 px-4 py-2 text-xs font-black uppercase hover:border-stone-500"
              >
                Duplicate Show
              </button>
            </form>
          </div>
        </header>

        {query.saved === "tickets" ? (
          <SuccessMessage>Ticket sales updated.</SuccessMessage>
        ) : null}

        {query.saved === "expense" ? (
          <SuccessMessage>Expense added.</SuccessMessage>
        ) : null}

        {query.saved === "expense-deleted" ? (
          <SuccessMessage>Expense deleted.</SuccessMessage>
        ) : null}

        {query.saved === "merch" ? (
          <SuccessMessage>Merchandise sale added.</SuccessMessage>
        ) : null}

        {query.saved === "merch-deleted" ? (
          <SuccessMessage>Merchandise sale deleted.</SuccessMessage>
        ) : null}

        {query.saved === "settlement" ? (
          <SuccessMessage>Show settlement updated.</SuccessMessage>
        ) : null}

        {query.saved === "show-details" ? (
          <SuccessMessage>Show details updated.</SuccessMessage>
        ) : null}
        {query.saved === "expense-updated" ? (
          <SuccessMessage>Expense updated.</SuccessMessage>
        ) : null}
        {query.saved === "reimbursement" ? (
          <SuccessMessage>Reimbursement status updated.</SuccessMessage>
        ) : null}
        {query.saved === "merch-updated" ? (
          <SuccessMessage>Merchandise sale updated.</SuccessMessage>
        ) : null}
        {query.saved === "duplicated" ? (
          <SuccessMessage>Show duplicated.</SuccessMessage>
        ) : null}
        {query.saved === "payment" ? (
          <SuccessMessage>Band payment updated.</SuccessMessage>
        ) : null}
        {query.saved === "payment-edited" ? (
          <SuccessMessage>Band payout edited.</SuccessMessage>
        ) : null}
        {query.saved === "payment-deleted" ? (
          <SuccessMessage>Band payment deleted.</SuccessMessage>
        ) : null}

        {query.error ? (
          <ErrorMessage>{query.error}</ErrorMessage>
        ) : null}

        {ticketError ? (
          <ErrorMessage>
            Could not load tickets: {ticketError.message}
          </ErrorMessage>
        ) : null}

        {expenseError ? (
          <ErrorMessage>
            Could not load expenses: {expenseError.message}
          </ErrorMessage>
        ) : null}

        {merchError ? (
          <ErrorMessage>
            Could not load merchandise sales: {merchError.message}
          </ErrorMessage>
        ) : null}
        {paymentError ? (
          <ErrorMessage>
            Could not load band payments: {paymentError.message}
          </ErrorMessage>
        ) : null}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Tickets Sold"
            value={`${actualTickets} / ${capacity}`}
            secondary={`${Number(show.capacity_percent).toFixed(
              1
            )}% capacity`}
          />

          <MetricCard
            label="Gross Ticket Sales"
            value={formatCurrency(Number(show.gross_ticket_sales))}
          />

          <MetricCard
            label="Payout Tier"
            value={`${Math.round(Number(show.payout_rate) * 100)}%`}
            secondary={getTierMessage(
              actualTickets,
              Number(show.tickets_to_next_tier)
            )}
          />

          <MetricCard
            label="Band Payout"
            value={formatCurrency(Number(show.ticket_payout))}
          />

          <MetricCard
            label="Net Show Profit"
            value={formatCurrency(Number(show.net_show_profit))}
          />

          <MetricCard
            label="Outstanding Reimbursements"
            value={formatCurrency(unreimbursedExpenses)}
            secondary={unreimbursedExpenses > 0 ? "Needs attention" : "All caught up"}
          />
        </section>

        <LiveTicketCalculator tickets={tickets} capacity={capacity} />

        <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <div>
            <h2 className="text-xl font-black uppercase">
              Show Details
            </h2>

            <p className="mt-1 text-sm text-stone-400">
              Update the event schedule, venue, attendance goals, and
              contract terms.
            </p>
          </div>

          <form
            action={updateShowDetails}
            className="mt-6 space-y-8"
          >
            <input
              type="hidden"
              name="show_id"
              value={id}
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <ExpenseField
                label="Show Name"
                name="show_name"
                defaultValue={showDetails.show_name ?? ""}
              />

              <ExpenseField
                label="Venue"
                name="venue_name"
                defaultValue={editableVenueName}
                required
              />

              <ExpenseField
                label="Show Date"
                name="show_date"
                type="date"
                defaultValue={showDetails.show_date}
                required
              />

              <ExpenseField
                label="Capacity"
                name="capacity"
                type="number"
                defaultValue={String(showDetails.capacity)}
                min="1"
                step="1"
                required
              />

              <ExpenseField
                label="Ticket Goal"
                name="ticket_goal"
                type="number"
                defaultValue={String(showDetails.ticket_goal ?? 50)}
                min="0"
                step="1"
              />

              <ExpenseField
                label="Number of Acts"
                name="number_of_acts"
                type="number"
                defaultValue={String(showDetails.number_of_acts ?? 3)}
                min="1"
                step="1"
              />
            </div>

            <div>
              <h3 className="font-black uppercase">
                Schedule
              </h3>

              <div className="mt-4 grid gap-5 md:grid-cols-3">
                <ExpenseField
                  label="Doors"
                  name="doors_time"
                  type="time"
                  defaultValue={trimTime(showDetails.doors_time)}
                />

                <ExpenseField
                  label="Show Starts"
                  name="start_time"
                  type="time"
                  defaultValue={trimTime(showDetails.start_time)}
                />

                <ExpenseField
                  label="Show Ends"
                  name="end_time"
                  type="time"
                  defaultValue={trimTime(showDetails.end_time)}
                />
              </div>
            </div>

            <div>
              <h3 className="font-black uppercase">
                Venue Terms
              </h3>

              <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <ExpenseField
                  label="Radius Clause Weeks"
                  name="radius_clause_weeks"
                  type="number"
                  defaultValue={String(
                    showDetails.radius_clause_weeks ?? 4
                  )}
                  min="0"
                  step="1"
                />

                <ExpenseField
                  label="Radius Clause Miles"
                  name="radius_clause_miles"
                  type="number"
                  defaultValue={String(
                    showDetails.radius_clause_miles ?? 20
                  )}
                  min="0"
                  step="1"
                />

                <ExpenseField
                  label="Food Discount %"
                  name="food_discount_percent"
                  type="number"
                  defaultValue={String(
                    showDetails.food_discount_percent ?? 40
                  )}
                  min="0"
                  step="0.01"
                />

                <ExpenseField
                  label="Meals Included At"
                  name="meals_included_ticket_threshold"
                  type="number"
                  defaultValue={String(
                    showDetails.meals_included_ticket_threshold ?? 50
                  )}
                  min="0"
                  step="1"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-semibold"
              >
                Show Notes
              </label>

              <textarea
                id="notes"
                name="notes"
                rows={5}
                defaultValue={showDetails.notes ?? ""}
                className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Set times, load-in details, parking, venue contact, settlement notes..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-6 py-3 font-black uppercase tracking-wide text-white hover:bg-red-500"
              >
                Save Show Details
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
          <div className="border-b border-stone-800 px-6 py-5">
            <h2 className="text-xl font-black uppercase">
              Ticket Sales
            </h2>

            <p className="mt-1 text-sm text-stone-400">
              Enter projected quantities before the show and actual
              quantities as tickets are sold.
            </p>
          </div>

          <form action={updateTicketSales}>
            <input type="hidden" name="show_id" value={id} />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-stone-950 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-6 py-4">Ticket Type</th>
                    <th className="px-6 py-4">Channel</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Projected</th>
                    <th className="px-6 py-4">Actual Sold</th>
                    <th className="px-6 py-4">Revenue</th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => {
                    const ticketRevenue =
                      Number(ticket.ticket_price) *
                      Number(ticket.actual_quantity);

                    return (
                      <tr
                        key={ticket.id}
                        className="border-t border-stone-800"
                      >
                        <td className="px-6 py-5 font-bold">
                          <input
                            type="hidden"
                            name="ticket_id"
                            value={ticket.id}
                          />
                          {ticket.ticket_type}
                        </td>

                        <td className="px-6 py-5 capitalize text-stone-400">
                          {ticket.channel}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-stone-500">$</span>
                            <input
                              name={`ticket_price_${ticket.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={Number(
                                ticket.ticket_price
                              ).toFixed(2)}
                              className="w-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 outline-none focus:border-red-500"
                            />
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <input
                            name={`projected_quantity_${ticket.id}`}
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={ticket.projected_quantity}
                            className="w-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 outline-none focus:border-red-500"
                          />
                        </td>

                        <td className="px-6 py-5">
                          <input
                            name={`actual_quantity_${ticket.id}`}
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={ticket.actual_quantity}
                            className="w-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 outline-none focus:border-red-500"
                          />
                        </td>

                        <td className="px-6 py-5 font-bold">
                          {formatCurrency(ticketRevenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="border-t border-stone-700 bg-stone-950/60">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-5 font-black uppercase"
                    >
                      Actual Totals
                    </td>
                    <td className="px-6 py-5 text-stone-500">—</td>
                    <td className="px-6 py-5 font-black">
                      {actualTickets}
                    </td>
                    <td className="px-6 py-5 font-black">
                      {formatCurrency(
                        Number(show.gross_ticket_sales)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end border-t border-stone-800 px-6 py-5">
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-6 py-3 font-black uppercase tracking-wide text-white hover:bg-red-500"
              >
                Save Ticket Sales
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
          <div className="border-b border-stone-800 px-6 py-5">
            <h2 className="text-xl font-black uppercase">
              Show Expenses
            </h2>

            <p className="mt-1 text-sm text-stone-400">
              Track projected costs, actual spending, reimbursements,
              and who paid.
            </p>
          </div>

          <div className="grid gap-4 border-b border-stone-800 p-6 sm:grid-cols-3">
            <ExpenseMetric
              label="Budgeted"
              value={formatCurrency(totalBudgetedExpenses)}
            />
            <ExpenseMetric
              label="Actual"
              value={formatCurrency(totalActualExpenses)}
            />
            <ExpenseMetric
              label="Unreimbursed"
              value={formatCurrency(unreimbursedExpenses)}
            />
          </div>

          {expenses.length > 0 ? (
            <div className="divide-y divide-stone-800">
              {expenses.map((expense) => (
                <details key={expense.id} className="p-6">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-bold">{expense.category}</p>
                        <p className="text-sm text-stone-400">{expense.description || "No description"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold">{formatCurrency(Number(expense.actual_amount))}</span>
                        <span className={expense.reimbursed
                          ? "rounded-full border border-emerald-800 px-3 py-1 text-xs font-bold uppercase text-emerald-300"
                          : "rounded-full border border-amber-800 px-3 py-1 text-xs font-bold uppercase text-amber-300"}>
                          {expense.reimbursed ? "Reimbursed" : "Unreimbursed"}
                        </span>
                        <span className="text-sm text-stone-500">Edit</span>
                      </div>
                    </div>
                  </summary>

                  <form action={updateExpense} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <input type="hidden" name="show_id" value={id} />
                    <input type="hidden" name="expense_id" value={expense.id} />
                    <ExpenseField label="Category" name="category" defaultValue={expense.category} required />
                    <ExpenseField label="Description" name="description" defaultValue={expense.description ?? ""} />
                    <ExpenseField label="Budget" name="budget_amount" type="number" step="0.01" min="0" defaultValue={String(expense.budget_amount)} />
                    <ExpenseField label="Actual" name="actual_amount" type="number" step="0.01" min="0" defaultValue={String(expense.actual_amount)} />
                    <ExpenseField label="Paid By" name="paid_by" defaultValue={expense.paid_by ?? ""} />
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Payment Method</label>
                      <select name="payment_method" defaultValue={expense.payment_method ?? ""} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3">
                        <option value="">Select</option><option value="cash">Cash</option><option value="venmo">Venmo</option><option value="card">Card</option><option value="other">Other</option>
                      </select>
                    </div>
                    <ExpenseField label="Notes" name="notes" defaultValue={expense.notes ?? ""} />
                    <label className="flex items-center gap-3 rounded-lg border border-stone-700 bg-stone-950 px-4 py-3">
                      <input type="checkbox" name="reimbursed" defaultChecked={expense.reimbursed} />
                      Reimbursed
                    </label>
                    <div className="md:col-span-2 xl:col-span-4 flex flex-wrap justify-end gap-3">
                      <button type="submit" className="rounded-lg bg-red-600 px-5 py-2 font-bold">Save Expense</button>
                    </div>
                  </form>

                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <form action={toggleExpenseReimbursed}>
                      <input type="hidden" name="show_id" value={id} />
                      <input type="hidden" name="expense_id" value={expense.id} />
                      <input type="hidden" name="reimbursed" value={expense.reimbursed ? "false" : "true"} />
                      <button className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold">
                        Mark {expense.reimbursed ? "Unreimbursed" : "Reimbursed"}
                      </button>
                    </form>
                    <details>
                      <summary className="cursor-pointer rounded-lg border border-red-900 px-4 py-2 text-sm font-bold text-red-400">Delete</summary>
                      <form action={deleteExpense} className="mt-2 flex items-center gap-3">
                        <input type="hidden" name="show_id" value={id} />
                        <input type="hidden" name="expense_id" value={expense.id} />
                        <span className="text-sm text-stone-400">Confirm deletion?</span>
                        <button className="font-bold text-red-400">Yes, delete</button>
                      </form>
                    </details>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-stone-500">No expenses entered for this show.</div>
          )}

          <form
            action={addExpense}
            className="border-t border-stone-800 p-6"
          >
            <input type="hidden" name="show_id" value={id} />

            <h3 className="font-black uppercase">Add Expense</h3>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <ExpenseField
                label="Category"
                name="category"
                placeholder="Promotion"
                required
              />
              <ExpenseField
                label="Description"
                name="description"
                placeholder="Poster printing"
              />
              <ExpenseField
                label="Budget Amount"
                name="budget_amount"
                type="number"
                defaultValue="0"
                step="0.01"
                min="0"
              />
              <ExpenseField
                label="Actual Amount"
                name="actual_amount"
                type="number"
                defaultValue="0"
                step="0.01"
                min="0"
              />
              <ExpenseField
                label="Paid By"
                name="paid_by"
                placeholder="Bobby"
              />

              <div>
                <label
                  htmlFor="expense_payment_method"
                  className="mb-2 block text-sm font-semibold"
                >
                  Payment Method
                </label>
                <select
                  id="expense_payment_method"
                  name="payment_method"
                  defaultValue=""
                  className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="">Select</option>
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <ExpenseField
                label="Notes"
                name="notes"
                placeholder="Optional notes"
              />

              <div className="flex items-end">
                <label className="flex w-full items-center gap-3 rounded-lg border border-stone-700 bg-stone-950 px-4 py-3">
                  <input
                    type="checkbox"
                    name="reimbursed"
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-semibold">
                    Already reimbursed
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-6 py-3 font-black uppercase tracking-wide text-white hover:bg-red-500"
              >
                Add Expense
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
          <div className="border-b border-stone-800 px-6 py-5">
            <h2 className="text-xl font-black uppercase">
              Merchandise
            </h2>

            <p className="mt-1 text-sm text-stone-400">
              Track show-specific merchandise sales and profit.
            </p>
          </div>

          <div className="grid gap-4 border-b border-stone-800 p-6 sm:grid-cols-3">
            <ExpenseMetric
              label="Merch Revenue"
              value={formatCurrency(merchRevenue)}
            />
            <ExpenseMetric
              label="Merch Cost"
              value={formatCurrency(merchCost)}
            />
            <ExpenseMetric
              label="Merch Profit"
              value={formatCurrency(merchProfit)}
            />
          </div>

          {merchSales.length > 0 ? (
            <div className="divide-y divide-stone-800">
              {merchSales.map((item) => {
                const revenue = Number(item.quantity_sold) * Number(item.unit_price);
                const cost = Number(item.quantity_sold) * Number(item.unit_cost);
                return (
                  <details key={item.id} className="p-6">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="font-bold">{item.item_name}</p>
                          <p className="text-sm text-stone-400">{item.quantity_sold} sold · {item.payment_method || "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(revenue - cost)} profit</p>
                          <p className="text-sm text-stone-500">Edit</p>
                        </div>
                      </div>
                    </summary>
                    <form action={updateMerchSale} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <input type="hidden" name="show_id" value={id} />
                      <input type="hidden" name="merch_id" value={item.id} />
                      <ExpenseField label="Item" name="item_name" defaultValue={item.item_name} required />
                      <ExpenseField label="Quantity" name="quantity_sold" type="number" min="0" step="1" defaultValue={String(item.quantity_sold)} />
                      <ExpenseField label="Price Each" name="unit_price" type="number" min="0" step="0.01" defaultValue={String(item.unit_price)} />
                      <ExpenseField label="Cost Each" name="unit_cost" type="number" min="0" step="0.01" defaultValue={String(item.unit_cost)} />
                      <div>
                        <label className="mb-2 block text-sm font-semibold">Payment Method</label>
                        <select name="payment_method" defaultValue={item.payment_method ?? "cash"} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3">
                          <option value="cash">Cash</option><option value="venmo">Venmo</option><option value="card">Card</option><option value="other">Other</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 xl:col-span-5 flex justify-end gap-3">
                        <button className="rounded-lg bg-red-600 px-5 py-2 font-bold">Save Merchandise</button>
                      </div>
                    </form>
                    <details className="mt-4 ml-auto w-fit">
                      <summary className="cursor-pointer rounded-lg border border-red-900 px-4 py-2 text-sm font-bold text-red-400">Delete</summary>
                      <form action={deleteMerchSale} className="mt-2 flex items-center gap-3">
                        <input type="hidden" name="show_id" value={id} />
                        <input type="hidden" name="merch_id" value={item.id} />
                        <span className="text-sm text-stone-400">Confirm deletion?</span>
                        <button className="font-bold text-red-400">Yes, delete</button>
                      </form>
                    </details>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-stone-500">No merchandise sales entered for this show.</div>
          )}

          <form
            action={addMerchSale}
            className="border-t border-stone-800 p-6"
          >
            <input type="hidden" name="show_id" value={id} />

            <h3 className="font-black uppercase">
              Add Merchandise Sale
            </h3>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              <ExpenseField
                label="Item"
                name="item_name"
                placeholder="T-Shirt"
                required
              />
              <ExpenseField
                label="Quantity Sold"
                name="quantity_sold"
                type="number"
                defaultValue="0"
                min="0"
                step="1"
              />
              <ExpenseField
                label="Price Each"
                name="unit_price"
                type="number"
                defaultValue="15"
                min="0"
                step="0.01"
              />
              <ExpenseField
                label="Cost Each"
                name="unit_cost"
                type="number"
                defaultValue="0"
                min="0"
                step="0.01"
              />

              <div>
                <label
                  htmlFor="merch_payment_method"
                  className="mb-2 block text-sm font-semibold"
                >
                  Payment Method
                </label>
                <select
                  id="merch_payment_method"
                  name="payment_method"
                  defaultValue="cash"
                  className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-6 py-3 font-black uppercase tracking-wide text-white hover:bg-red-500"
              >
                Add Merchandise Sale
              </button>
            </div>
          </form>
        </section>

                  <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <div>
           <h2 className="text-xl font-black uppercase">
              Show Settlement
           </h2>

           <p className="mt-1 text-sm text-stone-400">
              Enter any additional income and mark the show complete
              after the final payout is confirmed.
           </p>
          </div>

         <form
           action={updateShowSettlement}
           className="mt-6 grid gap-5 md:grid-cols-3"
          >
            <input
             type="hidden"
             name="show_id"
             value={id}
           />

           <div>
             <label
               htmlFor="status"
                className="mb-2 block text-sm font-semibold"
             >
                Show Status
              </label>

              <select
                id="status"
        name="status"
        defaultValue={show.status}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="draft">Draft</option>
                <option value="upcoming">Upcoming</option>
               <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

           <ExpenseField
             label="Other Income"
             name="other_income"
             type="number"
              defaultValue={String(
               Number(show.other_income ?? 0).toFixed(2)
             )}
             min="0"
             step="0.01"
            />

           <div className="flex items-end">
             <button
               type="submit"
               className="w-full rounded-lg bg-red-600 px-6 py-3 font-black uppercase tracking-wide text-white hover:bg-red-500"
             >
               Update Settlement
             </button>
           </div>
          </form>
        </section>

        <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <h2 className="text-xl font-black uppercase">Band Payout Splits</h2>
          <p className="mt-1 text-sm text-stone-400">Assign each member a payout and track whether it has been paid.</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ExpenseMetric label="Assigned" value={formatCurrency(totalAssignedPayments)} />
            <ExpenseMetric label="Paid" value={formatCurrency(totalPaidPayments)} />
            <ExpenseMetric label="Unassigned Profit" value={formatCurrency(unassignedProfit)} />
          </div>

          <div className="mt-6 space-y-3">
            {showPayments.map((payment) => (
              <details
                key={payment.id}
                className="rounded-lg border border-stone-800 bg-stone-950 p-4"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-bold">{payment.member_name}</p>
                    <p className="text-sm text-stone-400">
                      {formatCurrency(Number(payment.amount))}
                    </p>
                  </div>

                  <span
                    className={
                      payment.paid
                        ? "rounded-lg border border-emerald-800 px-4 py-2 text-sm font-bold text-emerald-300"
                        : "rounded-lg border border-amber-800 px-4 py-2 text-sm font-bold text-amber-300"
                    }
                  >
                    {payment.paid ? "Paid · Edit" : "Unpaid · Edit"}
                  </span>
                </summary>

                <form
                  action={updateShowPayment}
                  className="mt-5 grid gap-4 border-t border-stone-800 pt-5 md:grid-cols-3"
                >
                  <input type="hidden" name="show_id" value={id} />
                  <input type="hidden" name="payment_id" value={payment.id} />

                  <ExpenseField
                    label="Band Member"
                    name="member_name"
                    defaultValue={payment.member_name}
                    required
                  />

                  <ExpenseField
                    label="Payout Amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={Number(payment.amount).toFixed(2)}
                    required
                  />

                  <label className="flex items-center gap-3 rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 md:self-end">
                    <input
                      type="checkbox"
                      name="paid"
                      defaultChecked={payment.paid}
                    />
                    Paid
                  </label>

                  <div className="flex flex-wrap gap-3 md:col-span-3 md:justify-end">
                    <button className="rounded-lg bg-red-600 px-5 py-2 text-sm font-black uppercase hover:bg-red-500">
                      Save Payout
                    </button>
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-stone-800 pt-4">
                  <form action={toggleShowPayment}>
                    <input type="hidden" name="show_id" value={id} />
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input
                      type="hidden"
                      name="paid"
                      value={payment.paid ? "false" : "true"}
                    />
                    <button className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold hover:border-stone-500">
                      {payment.paid ? "Mark Unpaid" : "Mark Paid"}
                    </button>
                  </form>

                  <details>
                    <summary className="cursor-pointer rounded-lg border border-red-900 px-4 py-2 text-sm font-bold text-red-400">
                      Delete
                    </summary>
                    <form action={deleteShowPayment} className="mt-3 text-right">
                      <input type="hidden" name="show_id" value={id} />
                      <input type="hidden" name="payment_id" value={payment.id} />
                      <button className="text-sm font-bold text-red-400">
                        Confirm delete
                      </button>
                    </form>
                  </details>
                </div>
              </details>
            ))}
          </div>

          <form action={addShowPayment} className="mt-6 grid gap-4 md:grid-cols-3">
            <input type="hidden" name="show_id" value={id} />
            <ExpenseField label="Band Member" name="member_name" placeholder="Bobby" required />
            <ExpenseField label="Amount" name="amount" type="number" min="0" step="0.01" defaultValue="0" required />
            <label className="flex items-center gap-3 rounded-lg border border-stone-700 bg-stone-950 px-4 py-3">
              <input type="checkbox" name="paid" /> Already paid
            </label>
            <div className="md:col-span-3 flex justify-end">
              <button className="rounded-lg bg-red-600 px-6 py-3 font-black uppercase">Add Payment</button>
            </div>
          </form>
        </section>

        <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <h2 className="text-xl font-black uppercase">
           Financial Summary
          </h2>

         <div className="mt-6 space-y-4">
            <SummaryRow
              label="Gross ticket sales"
             value={formatCurrency(
               Number(show.gross_ticket_sales)
              )}
            />

           <SummaryRow
             label={`Band payout (${Math.round(
                Number(show.payout_rate) * 100
              )}%)`}
              value={formatCurrency(
               Number(show.ticket_payout)
              )}
           />

           <SummaryRow
             label="Merchandise revenue"
             value={formatCurrency(merchRevenue)}
           />

           <SummaryRow
             label="Merchandise cost"
             value={`-${formatCurrency(merchCost)}`}
           />

            <SummaryRow
              label="Other income"
              value={formatCurrency(
               Number(show.other_income ?? 0)
              )}
           />

            <SummaryRow
              label="Show expenses"
             value={`-${formatCurrency(totalActualExpenses)}`}
           />

           <div className="border-t border-stone-700 pt-5">
              <SummaryRow
               label="Final net show profit"
               value={formatCurrency(
                  Number(show.net_show_profit)
               )}
               emphasize
              />
           </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
            <h2 className="text-xl font-black uppercase">
              Projected Results
            </h2>

            <div className="mt-6 space-y-4">
              <SummaryRow
                label="Projected tickets"
                value={String(projectedTickets)}
              />
              <SummaryRow
                label="Projected gross"
                value={formatCurrency(projectedGross)}
              />
              <SummaryRow
                label="Projected payout tier"
                value={`${Math.round(projectedPayoutRate * 100)}%`}
              />
              <SummaryRow
                label="Projected band payout"
                value={formatCurrency(projectedPayout)}
                emphasize
              />
            </div>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
            <h2 className="text-xl font-black uppercase">
              Venue Benefits
            </h2>

            <div className="mt-6 space-y-4 text-sm">
              <SummaryRow
                label="Meals"
                value={
                  show.meals_included
                    ? "Included"
                    : "40% discount"
                }
              />
              <SummaryRow
                label="Meals threshold"
                value="50 tickets"
              />
              <SummaryRow
                label="PA and sound engineer"
                value="Provided"
              />
              <SummaryRow
                label="Box office staff"
                value="Provided"
              />
              <SummaryRow
                label="Radius clause"
                value="4 weeks / 20 miles"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SuccessMessage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-emerald-200">
      {children}
    </div>
  );
}

function ErrorMessage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-red-200">
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black">{value}</p>
      {secondary ? (
        <p className="mt-2 text-xs text-stone-500">{secondary}</p>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-stone-800 pb-4 last:border-0 last:pb-0">
      <span className="text-stone-400">{label}</span>
      <span
        className={
          emphasize
            ? "text-xl font-black text-red-400"
            : "font-bold"
        }
      >
        {value}
      </span>
    </div>
  );
}

function ExpenseMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

type ExpenseFieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  step?: string;
  min?: string;
  required?: boolean;
};

function ExpenseField({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  step,
  min,
  required = false,
}: ExpenseFieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-semibold"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        step={step}
        min={min}
        required={required}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
      />
    </div>
  );
}

function getPayoutRate(ticketCount: number) {
  if (ticketCount >= 50) return 0.7;
  if (ticketCount >= 30) return 0.6;
  if (ticketCount >= 10) return 0.5;
  return 0;
}

function getTierMessage(
  ticketsSold: number,
  ticketsToNextTier: number
) {
  if (ticketsSold >= 50) {
    return "Highest payout tier";
  }

  const target =
    ticketsSold < 10 ? 10 : ticketsSold < 30 ? 30 : 50;

  return `${ticketsToNextTier} more to reach ${target}`;
}

function trimTime(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
