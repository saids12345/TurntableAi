import assert from "node:assert/strict";

import {
  searchSquareCompletedOrders,
} from "@/lib/square";

import {
  aggregateSquareDailyPerformance,
  buildSquareDailyWindow,
} from "@/lib/squareDailyPerformance";

async function main() {
  process.env.SQUARE_ENVIRONMENT = "sandbox";
  process.env.SQUARE_APPLICATION_ID = "sandbox-test-app";

  const springWindow =
    buildSquareDailyWindow(
      "2026-03-08",
      "America/Los_Angeles",
    );

  assert.equal(
    springWindow.startAt,
    "2026-03-08T08:00:00.000Z",
  );

  assert.equal(
    springWindow.endAt,
    "2026-03-09T06:59:59.999Z",
  );

  assert.equal(
    springWindow.capturedAt,
    "2026-03-09T07:00:00.000Z",
  );

  const fallWindow =
    buildSquareDailyWindow(
      "2026-11-01",
      "America/Los_Angeles",
    );

  assert.equal(
    fallWindow.startAt,
    "2026-11-01T07:00:00.000Z",
  );

  assert.equal(
    fallWindow.endAt,
    "2026-11-02T07:59:59.999Z",
  );

  assert.equal(
    fallWindow.capturedAt,
    "2026-11-02T08:00:00.000Z",
  );

  const snapshot =
    aggregateSquareDailyPerformance(
      {
        environment:
          "production",

        merchantId:
          "merchant-1",

        locationId:
          "location-1",

        locationName:
          "Main Street",

        currency:
          "USD",

        localDate:
          "2026-10-01",

        capturedAt:
          "2026-10-02T07:00:00.000Z",

        orders: [
          {
            id:
              "order-1",

            location_id:
              "location-1",

            state:
              "COMPLETED",

            total_money: {
              amount:
                1250,

              currency:
                "USD",
            },
          },

          {
            id:
              "order-2",

            location_id:
              "location-1",

            state:
              "COMPLETED",

            total_money: {
              amount:
                2750,

              currency:
                "USD",
            },
          },

          {
            id:
              "ignored-open",

            location_id:
              "location-1",

            state:
              "OPEN",

            total_money: {
              amount:
                9999,

              currency:
                "USD",
            },
          },
        ],
      },
    );

  assert.deepEqual(
    snapshot,
    {
      sourceSystem:
        "square",

      sourceRecordId:
        "square:daily:production:merchant-1:location-1:2026-10-01",

      locationName:
        "Main Street",

      revenue:
        40,

      orders:
        2,

      avgTicket:
        20,

      laborPct:
        null,

      marginPct:
        null,

      refunds:
        null,

      capturedAt:
        "2026-10-02T07:00:00.000Z",
    },
  );

  assert.throws(
    () =>
      aggregateSquareDailyPerformance(
        {
          environment:
            "production",

          merchantId:
            "merchant-1",

          locationId:
            "location-1",

          locationName:
            "Main Street",

          currency:
            "JPY",

          localDate:
            "2026-10-01",

          capturedAt:
            "2026-10-02T07:00:00.000Z",

          orders: [],
        },
      ),
    /only supports USD/,
  );

  const originalFetch =
    globalThis.fetch;

  const requests:
    Array<{
      url: string;
      body:
        Record<
          string,
          unknown
        >;
    }> = [];

  let page = 0;

  globalThis.fetch =
    (async (
      input:
        string |
        URL |
        Request,
      init?:
        RequestInit,
    ) => {
      page += 1;

      const url =
        String(
          input,
        );

      const body =
        JSON.parse(
          String(
            init?.body ??
            "{}",
          ),
        ) as
          Record<
            string,
            unknown
          >;

      requests.push({
        url,
        body,
      });

      return new Response(
        JSON.stringify(
          page === 1
            ? {
                orders: [
                  {
                    id:
                      "page-1-order",

                    location_id:
                      "location-1",

                    state:
                      "COMPLETED",

                    total_money: {
                      amount:
                        1000,

                      currency:
                        "USD",
                    },
                  },
                ],

                cursor:
                  "next-page",
              }
            : {
                orders: [
                  {
                    id:
                      "page-2-order",

                    location_id:
                      "location-1",

                    state:
                      "COMPLETED",

                    total_money: {
                      amount:
                        2000,

                      currency:
                        "USD",
                    },
                  },
                ],
              },
        ),
        {
          status:
            200,

          headers: {
            "Content-Type":
              "application/json",
          },
        },
      );
    }) as typeof fetch;

  try {
    const orders =
      await searchSquareCompletedOrders(
        {
          accessToken:
            "test-token",

          locationId:
            "location-1",

          startAt:
            "2026-10-01T07:00:00.000Z",

          endAt:
            "2026-10-02T06:59:59.999Z",
        },
      );

    assert.equal(
      orders.length,
      2,
    );

    assert.equal(
      requests.length,
      2,
    );

    assert.equal(
      requests[0].url,
      "https://connect.squareupsandbox.com/v2/orders/search",
    );

    const firstBody =
      requests[0]
        .body as {
          location_ids:
            string[];

          limit:
            number;

          return_entries:
            boolean;

          query: {
            filter: {
              date_time_filter: {
                closed_at: {
                  start_at:
                    string;

                  end_at:
                    string;
                };
              };

              state_filter: {
                states:
                  string[];
              };
            };

            sort: {
              sort_field:
                string;

              sort_order:
                string;
            };
          };

          cursor?:
            string;
        };

    assert.deepEqual(
      firstBody.location_ids,
      [
        "location-1",
      ],
    );

    assert.equal(
      firstBody.limit,
      1000,
    );

    assert.equal(
      firstBody.return_entries,
      false,
    );

    assert.deepEqual(
      firstBody.query
        .filter
        .state_filter
        .states,
      [
        "COMPLETED",
      ],
    );

    assert.equal(
      firstBody.query
        .sort
        .sort_field,
      "CLOSED_AT",
    );

    assert.equal(
      firstBody.query
        .filter
        .date_time_filter
        .closed_at
        .start_at,
      "2026-10-01T07:00:00.000Z",
    );

    assert.equal(
      firstBody.query
        .filter
        .date_time_filter
        .closed_at
        .end_at,
      "2026-10-02T06:59:59.999Z",
    );

    assert.equal(
      (
        requests[1]
          .body as {
            cursor?:
              string;
          }
      ).cursor,
      "next-page",
    );

    console.log(
      "✓ Square daily performance regression test passed",
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
