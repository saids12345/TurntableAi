import {
  NextResponse,
} from "next/server";

import {
  getConfiguredSquareEnvironment,
  revokeSquareAuthorization,
} from "@/lib/square";

import {
  requireProForApi,
} from "@/lib/requirePro";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { user } =
      await requireProForApi();

    if (
      getConfiguredSquareEnvironment() !==
      "production"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "square_disconnect_requires_production",
        },
        {
          status: 503,
        },
      );
    }

    const supabase =
      getSupabaseAdmin();

    const {
      data: connections,
      error: lookupError,
    } =
      await supabase
        .from("pos_connections")
        .select(
          "id,provider_account_id",
        )
        .eq(
          "user_id",
          user.id,
        )
        .eq(
          "provider",
          "square",
        )
        .eq(
          "environment",
          "production",
        );

    if (lookupError) {
      throw new Error(
        `Square disconnect lookup failed: ${lookupError.message}`,
      );
    }

    let disconnected = 0;

    for (
      const connection of
        connections ?? []
    ) {
      const connectionId =
        String(
          connection.id,
        );

      const merchantId =
        String(
          connection.provider_account_id,
        );

      /*
       * Revoke Square authorization first.
       * Only remove our stored credentials
       * after Square confirms revocation.
       */
      await revokeSquareAuthorization(
        merchantId,
      );

      const {
        error: deleteError,
      } =
        await supabase
          .from(
            "pos_connections",
          )
          .delete()
          .eq(
            "id",
            connectionId,
          )
          .eq(
            "user_id",
            user.id,
          )
          .eq(
            "provider",
            "square",
          )
          .eq(
            "environment",
            "production",
          )
          .eq(
            "provider_account_id",
            merchantId,
          );

      if (deleteError) {
        throw new Error(
          `Square connection cleanup failed: ${deleteError.message}`,
        );
      }

      disconnected += 1;
    }

    return NextResponse.json({
      ok: true,
      disconnected,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error(
      "Square disconnect failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "square_disconnect_failed",
      },
      {
        status: 500,
      },
    );
  }
}
