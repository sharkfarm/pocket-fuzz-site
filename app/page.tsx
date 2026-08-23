import { createClient } from "@/lib/supabase/server";
import HomeClient, {
  type PublicHomeShow,
} from "@/components/home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("shows")
    .select(`
      id,
      show_name,
      show_date,
      start_time,
      public_slug,
      public_description,
      flyer_url,
      featured,
      venues (
        name,
        city,
        state
      )
    `)
    .eq("is_public", true)
    .not("public_slug", "is", null)
    .gte("show_date", today)
    .order("featured", { ascending: false })
    .order("show_date", { ascending: true })
    .limit(4);

  if (error) {
    //console.error("Could not load homepage shows:", error.message);
    console.error("PUBLIC SHOW QUERY ERROR:", error);
  }

  console.log("PUBLIC SHOW DATA:", data);

  return (
    <HomeClient
      upcomingShows={(data ?? []) as PublicHomeShow[]}
    />
  );
}

