import {
  NextResponse,
} from "next/server";

import {
  requireProForApi,
} from "@/lib/requirePro";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } =
      await requireProForApi();

    const supabase =
      getSupabaseAdmin();

    const {
      data: connections,
      error: connectionError,
    } =
      await supabase
        .from("pos_connections")
        .select(
          "id,last_synced_at",
        )
        .eq("user_id", user.id)
        .eq("provider", "square")
        .eq(
          "environment",
          "production",
        );

    if (connectionError) {
      throw new Error(
        `Square status connection lookup failed: ${connectionError.message}`,
      );
    }

    const connectionIds =
      (connections ?? []).map(
        (connection) =>
          String(connection.id),
      );

    if (!connectionIds.length) {
      return NextResponse.json({
        ok: true,
        connected: false,
        connectionCount: 0,
        locationCount: 0,
        lastSyncedAt: null,
      });
    }

    const {
      count: locationCount,
      error: locationError,
    } =
      await supabase
        .from("pos_locations")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .in(
          "connection_id",
          connectionIds,
        );

    if (locationError) {
      throw new Error(
        `Square status location lookup failed: ${locationError.message}`,
      );
    }

    const lastSyncedAt =
      (connections ?? [])
        .map(
          (connection) =>
            connection.last_synced_at
              ? String(
                  connection.last_synced_at,
                )
              : null,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        )
        .sort()
        .at(-1) ?? null;

    return NextResponse.json({
      ok: true,
      connected: true,
      connectionCount:
        connectionIds.length,
      locationCount:
        locationCount ?? 0,
      lastSyncedAt,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error(
      "Square status failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "square_status_failed",
      },
      {
        status: 500,
      },
    );
  }
}
