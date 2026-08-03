export const VENMO_USERNAME = "pocketfuzz";

export function buildVenmoPaymentUrl({
  amount,
  note,
}: {
  amount: number;
  note: string;
}) {
  const params = new URLSearchParams({
    txn: "pay",
    amount: amount.toFixed(2),
    note,
  });

  return `https://venmo.com/${VENMO_USERNAME}?${params.toString()}`;
}

export function formatOrderNumber(id: string) {
  return `PF-${id.slice(0, 8).toUpperCase()}`;
}
