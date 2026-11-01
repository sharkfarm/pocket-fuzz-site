"use client";
import { useFormStatus } from "react-dom";
export default function LedgerSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-50">{pending ? "Saving…" : children}</button>;
}
