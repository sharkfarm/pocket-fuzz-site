import Link from "next/link";

const links = [
  ["Shows", "/admin/shows"],
  ["Band", "/admin/band"],
  ["Venues", "/admin/venues"],
  ["Bookings", "/admin/bookings"],
  ["Reports", "/admin/reports"],
] as const;

export default function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-black uppercase tracking-wide text-stone-300 hover:border-red-600 hover:text-white">
          {label}
        </Link>
      ))}
    </nav>
  );
}
