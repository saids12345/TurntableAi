import "server-only";

import { z } from "zod";

import { TRUSTED_PERFORMANCE_SOURCES } from "@/lib/performanceSignalTrust";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const performanceSignalSchema = z
  .object({
    userId: z.string().uuid(),

    sourceSystem: z.enum(
      TRUSTED_PERFORMANCE_SOURCES,
    ),

    sourceRecordId: z
      .string()
      .trim()
      .min(1)
      .max(500),

    locationName: z
      .string()
      .trim()
      .min(1)
      .max(500),

    revenue: z
      .number()
      .finite()
      .nonnegative()
      .nullable()
      .optional(),

    orders: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional(),

    avgTicket: z
      .number()
      .finite()
      .nonnegative()
      .nullable()
      .optional(),

    laborPct: z
      .number()
      .finite()
      .nullable()
      .optional(),

    marginPct: z
      .number()
      .finite()
      .nullable()
      .optional(),

    refunds: z
      .number()
      .finite()
      .nonnegative()
      .nullable()
      .optional(),

    capturedAt: z
      .string()
      .datetime({
        offset: true,
      }),
  })
  .superRefine(
    (signal, ctx) => {
      const metrics = [
        signal.revenue,
        signal.orders,
        signal.avgTicket,
        signal.laborPct,
        signal.marginPct,
        signal.refunds,
      ];

      if (
        metrics.every(
          (value) =>
            value === null ||
            value === undefined,
        )
      ) {
        ctx.addIssue({
          code:
            z.ZodIssueCode.custom,
          message:
            "At least one performance metric is required.",
        });
      }
    },
  );

export type PerformanceSignalInput =
  z.input<
    typeof performanceSignalSchema
  >;

export async function ingestPerformanceSignal(
  input: PerformanceSignalInput,
) {
  const signal =
    performanceSignalSchema.parse(
      input,
    );

  const supabaseAdmin =
    getSupabaseAdmin();

  const { data, error } =
    await supabaseAdmin
      .from(
        "performance_signal_history",
      )
      .upsert(
        {
          user_id:
            signal.userId,
          location_name:
            signal.locationName,
          source_system:
            signal.sourceSystem,
          source_record_id:
            signal.sourceRecordId,
          revenue:
            signal.revenue ??
            null,
          orders:
            signal.orders ??
            null,
          avg_ticket:
            signal.avgTicket ??
            null,
          labor_pct:
            signal.laborPct ??
            null,
          margin_pct:
            signal.marginPct ??
            null,
          refunds:
            signal.refunds ??
            null,
          captured_at:
            signal.capturedAt,
        },
        {
          onConflict:
            "user_id,source_system,source_record_id",
        },
      )
      .select(
        "id, user_id, location_name, source_system, source_record_id, ingested_at, captured_at",
      )
      .single();

  if (error) {
    throw new Error(
      `Performance signal ingestion failed: ${error.message}`,
    );
  }

  return data;
}
