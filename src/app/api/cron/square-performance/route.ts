import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  listSquareProductionUserIds,
} from "@/lib/squareConnectionReader";

import {
  syncSquareDailyPerformanceForUser,
} from "@/lib/squareDailySync";

import {
  getSquareCronHttpStatus,
} from "@/lib/squareCronStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  const secret =
    process.env.CRON_SECRET;

  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !secret ||
    authorization !==
      `Bearer ${secret}`
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized cron request",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const userIds =
      await listSquareProductionUserIds();

    let syncedRows = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const userId of userIds) {
      const result =
        await syncSquareDailyPerformanceForUser({
          userId,
          completedDays: 3,
        });

      syncedRows +=
        result.syncedRows;

      failureCount +=
        result.failures.length;

      skippedCount +=
        result.skipped.length;
    }

    const status =
      getSquareCronHttpStatus(
        failureCount,
      );

    const ok =
      status === 200;

    return NextResponse.json(
      {
        ok,

        users:
          userIds.length,

        syncedRows,
        failureCount,
        skippedCount,

        generatedAt:
          new Date().toISOString(),
      },
      {
        status,
      },
    );
  } catch (error) {
    console.error(
      "Square performance cron failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Square performance sync failed",
      },
      {
        status: 500,
      },
    );
  }
}
