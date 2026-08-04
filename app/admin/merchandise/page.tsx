import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    show?: string;
    payment?: string;
    item?: string;
  }>;
};

type MerchSale = {
  id: string;
  show_id: string;
  item_name: string;
  size: string | null;
  quantity_sold: number;
  unit_price: number | string;
  unit_cost: number | string;
  payment_method: string | null;
  created_at: string;
  shows:
    | {
        show_name: string | null;
        show_date: string;
      }
    | Array<{
        show_name: string | null;
        show_date: string;
      }>
    | null;
};

type ShowOption = {
  id: string;
  show_name: string | null;
  show_date: string;
};

export default async function MerchandisePage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const selectedShow = String(query.show ?? "").trim();
  const selectedPayment = String(query.payment ?? "").trim();
  const selectedItem = String(query.item ?? "").trim();

  let salesQuery = supabase
    .from("merch_sales")
    .select(`
      id,
      show_id,
      item_name,
      size,
      quantity_sold,
      unit_price,
      unit_cost,
      payment_method,
      created_at,
      shows (
        show_name,
        show_date
      )
    `)
    .order("created_at", { ascending: false });

  if (selectedShow) {
    salesQuery = salesQuery.eq("show_id", selectedShow);
  }

  if (selectedPayment) {
    salesQuery = salesQuery.eq("payment_method", selectedPayment);
  }

  if (selectedItem) {
    salesQuery = salesQuery.eq("item_name", selectedItem);
  }

  const [
    { data: salesData, error: salesError },
    { data: showData, error: showError },
  ] = await Promise.all([
    salesQuery,
    supabase
      .from("shows")
      .select("id,show_name,show_date")
      .order("show_date", { ascending: false }),
  ]);

  const sales = (salesData ?? []) as MerchSale[];
  const shows = (showData ?? []) as ShowOption[];

  const totalRevenue = sales.reduce(
    (sum, sale) =>
      sum +
      Number(sale.quantity_sold) *
        Number(sale.unit_price),
    0
  );

  const totalCost = sales.reduce(
    (sum, sale) =>
      sum +
      Number(sale.quantity_sold) *
        Number(sale.unit_cost),
    0
  );

  const totalProfit = totalRevenue - totalCost;

  const totalItems = sales.reduce(
    (sum, sale) => sum + Number(sale.quantity_sold),
    0
  );

  const itemNames = Array.from(
    new Set(sales.map((sale) => sale.item_name))
  ).sort();

  const paymentMethods = Array.from(
    new Set(
      sales
        .map((sale) => sale.payment_method)
        .filter((value): value is string => Boolean(value))
    )
  ).sort();

  const byItem = summarizeByItem(sales);
  const bySize = summarizeBySize(sales);
  const byPayment = summarizeByPayment(sales);
  const byShow = summarizeByShow(sales);

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-10 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz Admin
            </p>

            <h1 className="mt-3 text-4xl font-black uppercase">
              Merchandise
            </h1>

            <p className="mt-2 text-stone-400">
              Merchandise revenue is tracked separately from venue ticket sales.
            </p>
          </div>

          <Link
            href="/admin"
            className="w-fit rounded-lg border border-stone-700 px-4 py-3 text-sm font-bold hover:border-stone-500"
          >
            Back to Dashboard
          </Link>
        </div>

        {salesError || showError ? (
          <div className="mt-7 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            {salesError?.message ?? showError?.message}
          </div>
        ) : null}

        <form className="mt-8 grid gap-4 rounded-2xl border border-stone-800 bg-stone-900 p-5 md:grid-cols-4">
          <FilterSelect
            label="Show"
            name="show"
            value={selectedShow}
            options={[
              { value: "", label: "All shows" },
              ...shows.map((show) => ({
                value: show.id,
                label: `${show.show_name || "Untitled Show"} · ${formatDate(
                  show.show_date
                )}`,
              })),
            ]}
          />

          <FilterSelect
            label="Item"
            name="item"
            value={selectedItem}
            options={[
              { value: "", label: "All items" },
              ...itemNames.map((item) => ({
                value: item,
                label: item,
              })),
            ]}
          />

          <FilterSelect
            label="Payment"
            name="payment"
            value={selectedPayment}
            options={[
              { value: "", label: "All payment methods" },
              ...paymentMethods.map((method) => ({
                value: method,
                label: titleCase(method),
              })),
            ]}
          />

          <div className="flex items-end gap-3">
            <button className="rounded-lg bg-red-600 px-5 py-3 font-black uppercase hover:bg-red-500">
              Apply
            </button>

            <Link
              href="/admin/merchandise"
              className="rounded-lg border border-stone-700 px-5 py-3 font-bold hover:border-stone-500"
            >
              Clear
            </Link>
          </div>
        </form>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Merch Revenue"
            value={formatCurrency(totalRevenue)}
          />

          <MetricCard
            label="Merch Cost"
            value={formatCurrency(totalCost)}
          />

          <MetricCard
            label="Merch Profit"
            value={formatCurrency(totalProfit)}
          />

          <MetricCard
            label="Items Sold"
            value={String(totalItems)}
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <SummaryTable
            title="Sales by Item"
            headers={["Item", "Qty", "Revenue", "Profit"]}
            rows={byItem.map((row) => [
              row.label,
              String(row.quantity),
              formatCurrency(row.revenue),
              formatCurrency(row.profit),
            ])}
          />

          <SummaryTable
            title="Sales by Show"
            headers={["Show", "Qty", "Revenue", "Profit"]}
            rows={byShow.map((row) => [
              row.label,
              String(row.quantity),
              formatCurrency(row.revenue),
              formatCurrency(row.profit),
            ])}
          />

          <SummaryTable
            title="T-Shirt Size Breakdown"
            headers={["Size", "Qty", "Revenue", "Profit"]}
            rows={bySize.map((row) => [
              row.label,
              String(row.quantity),
              formatCurrency(row.revenue),
              formatCurrency(row.profit),
            ])}
          />

          <SummaryTable
            title="Payment Methods"
            headers={["Method", "Qty", "Revenue", "Profit"]}
            rows={byPayment.map((row) => [
              row.label,
              String(row.quantity),
              formatCurrency(row.revenue),
              formatCurrency(row.profit),
            ])}
          />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
          <div className="border-b border-stone-800 px-6 py-5">
            <h2 className="text-xl font-black uppercase">
              Recent Merchandise Sales
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-950 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Show</th>
                  <th className="px-5 py-4">Item</th>
                  <th className="px-5 py-4">Size</th>
                  <th className="px-5 py-4 text-right">Qty</th>
                  <th className="px-5 py-4 text-right">Revenue</th>
                  <th className="px-5 py-4 text-right">Cost</th>
                  <th className="px-5 py-4 text-right">Profit</th>
                  <th className="px-5 py-4">Payment</th>
                </tr>
              </thead>

              <tbody>
                {sales.map((sale) => {
                  const show = Array.isArray(sale.shows)
                    ? sale.shows[0]
                    : sale.shows;

                  const revenue =
                    Number(sale.quantity_sold) *
                    Number(sale.unit_price);

                  const cost =
                    Number(sale.quantity_sold) *
                    Number(sale.unit_cost);

                  return (
                    <tr
                      key={sale.id}
                      className="border-t border-stone-800"
                    >
                      <td className="px-5 py-4 text-stone-400">
                        {formatDateTime(sale.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        {show?.show_name || "Unknown show"}
                      </td>

                      <td className="px-5 py-4 font-bold">
                        {sale.item_name}
                      </td>

                      <td className="px-5 py-4">
                        {sale.size || "—"}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {sale.quantity_sold}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {formatCurrency(revenue)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {formatCurrency(cost)}
                      </td>

                      <td className="px-5 py-4 text-right font-bold">
                        {formatCurrency(revenue - cost)}
                      </td>

                      <td className="px-5 py-4">
                        {titleCase(sale.payment_method || "unknown")}
                      </td>
                    </tr>
                  );
                })}

                {sales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-stone-500"
                    >
                      No merchandise sales match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

type SummaryRow = {
  label: string;
  quantity: number;
  revenue: number;
  profit: number;
};

function summarizeByItem(sales: MerchSale[]) {
  return summarize(
    sales,
    (sale) => sale.item_name
  );
}

function summarizeBySize(sales: MerchSale[]) {
  return summarize(
    sales.filter((sale) => Boolean(sale.size)),
    (sale) => sale.size || "Unspecified"
  );
}

function summarizeByPayment(sales: MerchSale[]) {
  return summarize(
    sales,
    (sale) => titleCase(sale.payment_method || "unknown")
  );
}

function summarizeByShow(sales: MerchSale[]) {
  return summarize(
    sales,
    (sale) => {
      const show = Array.isArray(sale.shows)
        ? sale.shows[0]
        : sale.shows;

      return show?.show_name || "Unknown show";
    }
  );
}

function summarize(
  sales: MerchSale[],
  getLabel: (sale: MerchSale) => string
): SummaryRow[] {
  const map = new Map<string, SummaryRow>();

  for (const sale of sales) {
    const label = getLabel(sale);
    const quantity = Number(sale.quantity_sold);
    const revenue = quantity * Number(sale.unit_price);
    const cost = quantity * Number(sale.unit_cost);

    const current = map.get(label) ?? {
      label,
      quantity: 0,
      revenue: 0,
      profit: 0,
    };

    current.quantity += quantity;
    current.revenue += revenue;
    current.profit += revenue - cost;

    map.set(label, current);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.revenue - a.revenue
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{
    value: string;
    label: string;
  }>;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold">
        {label}
      </span>

      <select
        name={name}
        defaultValue={value}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3"
      >
        {options.map((option) => (
          <option
            key={`${name}-${option.value}`}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
      <p className="text-xs font-black uppercase tracking-wide text-stone-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function SummaryTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
      <div className="border-b border-stone-800 px-6 py-5">
        <h2 className="text-xl font-black uppercase">
          {title}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-950 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-5 py-4 last:text-right"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={`${title}-${rowIndex}`}
                className="border-t border-stone-800"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${title}-${rowIndex}-${cellIndex}`}
                    className="px-5 py-4 last:text-right"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-6 py-10 text-center text-stone-500"
                >
                  No data available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
