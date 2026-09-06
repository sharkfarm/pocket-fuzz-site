import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const expectedKey = process.env.PF_COM_API_KEY;
    const suppliedKey = request.headers.get("x-pf-com-api-key");

    if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) {
      return unauthorized();
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Pocket Fuzz Supabase server configuration is incomplete." },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } = await supabase
      .from("shows")
      .select(`
        id,
        show_name,
        show_date,
        venue_id,
        public_slug,
        venues (
          name
        )
      `)
      .order("show_date", { ascending: true });

    if (error) {
      throw error;
    }

    const shows = (data ?? []).map((show) => {
      const venueRelation = show.venues as
        | { name?: string | null }
        | { name?: string | null }[]
        | null;

      const venueName = Array.isArray(venueRelation)
        ? venueRelation[0]?.name ?? null
        : venueRelation?.name ?? null;

      return {
        id: show.id,
        show_name: show.show_name,
        show_date: show.show_date,
        venue_id: show.venue_id,
        venue_name: venueName,
        public_slug: show.public_slug,
      };
    });

    return NextResponse.json({ shows });
  } catch (error) {
    console.error("PF-COM SHOWS API ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load shows.",
      },
      { status: 500 }
    );
  }
}
