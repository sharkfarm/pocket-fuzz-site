import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-6 text-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-8 shadow-2xl">
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-red-500">
            Pocket Fuzz
          </p>

          <h1 className="text-3xl font-black uppercase tracking-tight">
            Show Dashboard
          </h1>

          <p className="mt-2 text-sm text-stone-400">
            Sign in to manage shows, ticket sales, expenses,
            and payouts.
          </p>
        </div>

        {params.error ? (
          <div className="mb-5 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">
            {params.error}
          </div>
        ) : null}

        <form action={login} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold"
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none transition focus:border-red-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none transition focus:border-red-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-red-600 px-4 py-3 font-black uppercase tracking-wide text-white transition hover:bg-red-500"
          >
            Sign In
          </button>
        </form>

        <a
          href="/"
          className="mt-6 block text-center text-sm text-stone-500 hover:text-stone-300"
        >
          Return to Pocket Fuzz
        </a>
      </div>
    </main>
  );
}