import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const expectedKey = process.env.PF_COM_API_KEY;
    const suppliedKey = request.headers.get("x-pf-com-api-key");

    if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error: "Pocket Fuzz Supabase server configuration is incomplete.",
          missing: {
            NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: !serviceRoleKey,
          },
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Load shows without relying on a PostgREST relationship name.
    const { data: shows, error: showsError } = await supabase
      .from("shows")
      .select(`
        id,
        show_name,
        show_date,
        venue_id,
        public_slug
      `)
      .order("show_date", { ascending: true });

    if (showsError) {
      console.error("PF-COM SHOWS QUERY ERROR:", showsError);

      return NextResponse.json(
        {
          error: "Could not load shows.",
          detail: showsError.message,
          code: showsError.code,
          hint: showsError.hint,
        },
        { status: 500 }
      );
    }

    const venueIds = Array.from(
      new Set(
        (shows ?? [])
          .map((show) => show.venue_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const venueNameById = new Map<string, string>();

    if (venueIds.length > 0) {
      const { data: venues, error: venuesError } = await supabase
        .from("venues")
        .select("id,name")
        .in("id", venueIds);

      if (venuesError) {
        console.error("PF-COM VENUES QUERY ERROR:", venuesError);

        return NextResponse.json(
          {
            error: "Could not load show venues.",
            detail: venuesError.message,
            code: venuesError.code,
            hint: venuesError.hint,
          },
          { status: 500 }
        );
      }

      for (const venue of venues ?? []) {
        venueNameById.set(venue.id, venue.name);
      }
    }

    return NextResponse.json({
      shows: (shows ?? []).map((show) => ({
        id: show.id,
        show_name: show.show_name,
        show_date: show.show_date,
        venue_id: show.venue_id,
        venue_name: show.venue_id
          ? venueNameById.get(show.venue_id) ?? null
          : null,
        public_slug: show.public_slug,
      })),
    });
  } catch (error) {
    console.error("PF-COM SHOWS API ERROR:", error);

    return NextResponse.json(
      {
        error: "Could not load shows.",
        detail:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
