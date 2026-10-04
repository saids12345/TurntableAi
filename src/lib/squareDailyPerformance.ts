import "server-only";

import type {
  SquareEnvironment,
  SquareOrder,
} from "@/lib/square";

const LOCAL_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/;

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

export type SquareDailyWindow = {
  localDate: string;
  timezone: string;
  startAt: string;
  endAt: string;
  capturedAt: string;
};

export type SquareDailyPerformanceSnapshot = {
  sourceSystem: "square";
  sourceRecordId: string;
  locationName: string;
  revenue: number;
  orders: number;
  avgTicket: number | null;
  laborPct: null;
  marginPct: null;
  refunds: null;
  capturedAt: string;
};

function parseLocalDate(
  localDate: string,
): LocalDateParts {
  const match =
    LOCAL_DATE_PATTERN.exec(
      localDate,
    );

  if (!match) {
    throw new Error(
      "Square localDate must use YYYY-MM-DD.",
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const check =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !==
      month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(
      "Square localDate is not a valid calendar date.",
    );
  }

  return {
    year,
    month,
    day,
  };
}

function assertTimezone(
  timezone: string,
) {
  const clean =
    timezone.trim();

  if (!clean) {
    throw new Error(
      "Square location timezone is required.",
    );
  }

  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          clean,
      },
    ).format(
      new Date(),
    );
  } catch {
    throw new Error(
      `Invalid Square location timezone: ${clean}`,
    );
  }

  return clean;
}

function zonedParts(
  instantMs: number,
  timezone: string,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          timezone,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",
      },
    );

  const values:
    Record<
      string,
      string
    > = {};

  for (
    const part
    of formatter.formatToParts(
      new Date(
        instantMs,
      ),
    )
  ) {
    if (
      part.type !==
      "literal"
    ) {
      values[
        part.type
      ] = part.value;
    }
  }

  return {
    year:
      Number(
        values.year,
      ),

    month:
      Number(
        values.month,
      ),

    day:
      Number(
        values.day,
      ),

    hour:
      Number(
        values.hour,
      ),

    minute:
      Number(
        values.minute,
      ),

    second:
      Number(
        values.second,
      ),
  };
}

function localMidnightToUtcMs(
  parts: LocalDateParts,
  timezone: string,
) {
  const targetAsUtc =
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      0,
      0,
      0,
      0,
    );

  let guess =
    targetAsUtc;

  for (
    let attempt = 0;
    attempt < 4;
    attempt += 1
  ) {
    const local =
      zonedParts(
        guess,
        timezone,
      );

    const representedAsUtc =
      Date.UTC(
        local.year,
        local.month - 1,
        local.day,
        local.hour,
        local.minute,
        local.second,
        0,
      );

    const difference =
      targetAsUtc -
      representedAsUtc;

    if (
      difference === 0
    ) {
      return guess;
    }

    guess +=
      difference;
  }

  const finalLocal =
    zonedParts(
      guess,
      timezone,
    );

  if (
    finalLocal.year !==
      parts.year ||
    finalLocal.month !==
      parts.month ||
    finalLocal.day !==
      parts.day ||
    finalLocal.hour !==
      0 ||
    finalLocal.minute !==
      0 ||
    finalLocal.second !==
      0
  ) {
    throw new Error(
      `Could not resolve local midnight for ${timezone}.`,
    );
  }

  return guess;
}

function nextLocalDate(
  parts: LocalDateParts,
): LocalDateParts {
  const next =
    new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day + 1,
      ),
    );

  return {
    year:
      next.getUTCFullYear(),

    month:
      next.getUTCMonth() +
      1,

    day:
      next.getUTCDate(),
  };
}

export function buildSquareDailyWindow(
  localDate: string,
  timezone: string,
): SquareDailyWindow {
  const dateParts =
    parseLocalDate(
      localDate,
    );

  const cleanTimezone =
    assertTimezone(
      timezone,
    );

  const startMs =
    localMidnightToUtcMs(
      dateParts,
      cleanTimezone,
    );

  const nextStartMs =
    localMidnightToUtcMs(
      nextLocalDate(
        dateParts,
      ),
      cleanTimezone,
    );

  if (
    nextStartMs <=
    startMs
  ) {
    throw new Error(
      "Square daily window produced an invalid time range.",
    );
  }

  return {
    localDate,

    timezone:
      cleanTimezone,

    startAt:
      new Date(
        startMs,
      ).toISOString(),

    /*
     * SearchOrders closed_at
     * boundaries are inclusive.
     * End one millisecond before
     * the next local day.
     */
    endAt:
      new Date(
        nextStartMs - 1,
      ).toISOString(),

    /*
     * capturedAt represents the
     * stable logical end of this
     * completed local calendar day.
     */
    capturedAt:
      new Date(
        nextStartMs,
      ).toISOString(),
  };
}

function requireText(
  value: string,
  label: string,
) {
  const clean =
    value.trim();

  if (!clean) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return clean;
}

function readOrderMoney(
  money:
    | {
        amount?: number;
        currency?: string;
      }
    | undefined,
  expectedCurrency: string,
  label: string,
) {
  const amount =
    money?.amount;

  if (
    typeof amount !==
      "number" ||
    !Number.isSafeInteger(
      amount,
    ) ||
    amount < 0
  ) {
    throw new Error(
      `${label} is missing a valid amount.`,
    );
  }

  const currency =
    money?.currency
      ?.trim()
      .toUpperCase();

  if (
    currency !==
    expectedCurrency
  ) {
    throw new Error(
      `${label} has unexpected currency ${currency || "(missing)"}.`,
    );
  }

  return amount;
}

function readOrderAmount(
  order: SquareOrder,
  expectedCurrency: string,
) {
  const orderId =
    order.id ??
    "(unknown)";

  if (
    (order.returns?.length ?? 0) >
      0 ||
    (order.refunds?.length ?? 0) >
      0
  ) {
    throw new Error(
      `Square completed order ${orderId} contains returns or refunds. Trusted daily sales V1 fails closed.`,
    );
  }

  const total =
    readOrderMoney(
      order.total_money,
      expectedCurrency,
      `Square completed order ${orderId} total_money`,
    );

  const tax =
    readOrderMoney(
      order.total_tax_money,
      expectedCurrency,
      `Square completed order ${orderId} total_tax_money`,
    );

  const tip =
    readOrderMoney(
      order.total_tip_money,
      expectedCurrency,
      `Square completed order ${orderId} total_tip_money`,
    );

  const serviceCharge =
    readOrderMoney(
      order.total_service_charge_money,
      expectedCurrency,
      `Square completed order ${orderId} total_service_charge_money`,
    );

  if (serviceCharge > 0) {
    throw new Error(
      `Square completed order ${orderId} contains service charges. Trusted daily sales V1 fails closed.`,
    );
  }

  const revenue =
    total -
    tax -
    tip;

  if (revenue < 0) {
    throw new Error(
      `Square completed order ${orderId} produced negative trusted sales.`,
    );
  }

  return revenue;
}

export function aggregateSquareDailyPerformance(
  input: {
    environment:
      SquareEnvironment;

    merchantId:
      string;

    locationId:
      string;

    locationName:
      string;

    currency:
      string;

    localDate:
      string;

    capturedAt:
      string;

    orders:
      SquareOrder[];
  },
): SquareDailyPerformanceSnapshot {
  const merchantId =
    requireText(
      input.merchantId,
      "Square merchant id",
    );

  const locationId =
    requireText(
      input.locationId,
      "Square location id",
    );

  const locationName =
    requireText(
      input.locationName,
      "Square location name",
    );

  const currency =
    requireText(
      input.currency,
      "Square location currency",
    ).toUpperCase();

  /*
   * performance_signal_history
   * currently has no currency field.
   * V1 therefore fails closed rather
   * than guessing minor-unit scaling.
   */
  if (
    currency !== "USD"
  ) {
    throw new Error(
      `Square daily performance V1 only supports USD locations. Received ${currency}.`,
    );
  }

  /*
   * Parse and validate before using
   * localDate in provenance.
   */
  parseLocalDate(
    input.localDate,
  );

  const capturedAtMs =
    Date.parse(
      input.capturedAt,
    );

  if (
    !Number.isFinite(
      capturedAtMs,
    )
  ) {
    throw new Error(
      "Square capturedAt must be a valid timestamp.",
    );
  }

  const completed =
    input.orders.filter(
      (order) =>
        order.state ===
          "COMPLETED" &&
        order.location_id ===
          locationId,
    );

  let totalMinorUnits =
    0;

  for (
    const order
    of completed
  ) {
    totalMinorUnits +=
      readOrderAmount(
        order,
        currency,
      );

    if (
      !Number.isSafeInteger(
        totalMinorUnits,
      )
    ) {
      throw new Error(
        "Square daily revenue exceeds JavaScript safe integer precision.",
      );
    }
  }

  const revenue =
    totalMinorUnits /
    100;

  const orderCount =
    completed.length;

  const avgTicket =
    orderCount > 0
      ? Number(
          (
            revenue /
            orderCount
          ).toFixed(
            2,
          ),
        )
      : null;

  return {
    sourceSystem:
      "square",

    sourceRecordId:
      [
        "square",
        "daily",
        input.environment,
        merchantId,
        locationId,
        input.localDate,
      ].join(
        ":",
      ),

    locationName,

    revenue:
      Number(
        revenue.toFixed(
          2,
        ),
      ),

    orders:
      orderCount,

    avgTicket,

    laborPct:
      null,

    marginPct:
      null,

    refunds:
      null,

    capturedAt:
      new Date(
        capturedAtMs,
      ).toISOString(),
  };
}

export function getRecentCompletedLocalDates(
  timezone: string,
  count = 3,
  now = new Date(),
) {
  const cleanTimezone =
    assertTimezone(timezone);

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 7
  ) {
    throw new Error(
      "Square completed-day count must be between 1 and 7.",
    );
  }

  if (!Number.isFinite(now.getTime())) {
    throw new Error(
      "Square sync now timestamp is invalid.",
    );
  }

  const localNow =
    zonedParts(
      now.getTime(),
      cleanTimezone,
    );

  const anchor =
    Date.UTC(
      localNow.year,
      localNow.month - 1,
      localNow.day,
    );

  return Array.from(
    { length: count },
    (_, index) => {
      const date =
        new Date(
          anchor -
            (index + 1) *
              24 *
              60 *
              60 *
              1000,
        );

      const year =
        date.getUTCFullYear();

      const month =
        String(
          date.getUTCMonth() + 1,
        ).padStart(2, "0");

      const day =
        String(
          date.getUTCDate(),
        ).padStart(2, "0");

      return `${year}-${month}-${day}`;
    },
  );
}
