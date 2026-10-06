import assert from "node:assert/strict";

import {
  requireRestaurantStateRows,
} from "@/lib/restaurantState";

const emptyRows =
  requireRestaurantStateRows<{
    id: string;
  }>(
    {
      data: [],
      error: null,
    },
    "trusted performance",
  );

assert.deepEqual(
  emptyRows,
  [],
);

const validRows =
  requireRestaurantStateRows<{
    id: string;
  }>(
    {
      data: [
        {
          id: "row-1",
        },
      ],
      error: null,
    },
    "trusted performance",
  );

assert.deepEqual(
  validRows,
  [
    {
      id: "row-1",
    },
  ],
);

assert.throws(
  () =>
    requireRestaurantStateRows(
      {
        data: null,
        error: {
          message:
            "sensitive internal database detail",
        },
      },
      "trusted performance",
    ),
  {
    name: "Error",
    message:
      "Restaurant State data unavailable: trusted performance could not be loaded.",
  },
);

assert.throws(
  () =>
    requireRestaurantStateRows(
      {
        data: null,
        error: null,
      },
      "reviews",
    ),
  {
    name: "Error",
    message:
      "Restaurant State data unavailable: reviews returned an invalid response.",
  },
);

console.log(
  "✓ Restaurant state data error regression test passed",
);
