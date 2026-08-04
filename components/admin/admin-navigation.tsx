"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/shows", label: "Shows" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/venmo", label: "Venmo" },
  { href: "/admin/merchandise", label: "Merchandise" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/website", label: "Website" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNavigation() {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-800 bg-stone-950/95 text-stone-100 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <Link href="/admin" className="w-fit">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz
            </p>
            <p className="mt-1 text-lg font-black uppercase tracking-wide">
              Admin
            </p>
          </Link>

          <nav className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:justify-end">
            {links.map((link) => {
              const active =
                link.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? "whitespace-nowrap rounded-lg bg-red-600 px-3 py-2 text-xs font-black uppercase text-white"
                      : "whitespace-nowrap rounded-lg border border-stone-800 px-3 py-2 text-xs font-black uppercase text-stone-400 hover:border-stone-600 hover:text-white"
                  }
                >
                  {link.label}
                </Link>
              );
            })}

            <form action="/admin/logout" method="post">
              <button
                type="submit"
                className="whitespace-nowrap rounded-lg border border-stone-700 px-3 py-2 text-xs font-black uppercase text-stone-300 hover:border-red-700 hover:text-red-300"
              >
                Sign Out
              </button>
            </form>
          </nav>
        </div>
      </div>
    </header>
  );
}
