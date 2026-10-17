export type ConnectedGoogleReviewLocation = {
  name: string;
  title?: string | null;
};

export function mapConnectedGoogleReviewRows<
  T extends { location_name: string | null },
>(
  locations: readonly ConnectedGoogleReviewLocation[],
  reviews: readonly T[],
): T[] {
  const displayByResource = new Map<string, string>();
  const resourcesByDisplay = new Map<string, Set<string>>();
  const conflictingResources = new Set<string>();

  const normalize = (value: string) =>
    value.toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  for (const location of locations) {
    const resource = location.name.trim();
    const display = location.title?.trim() || resource;
    const key = normalize(display);

    if (!resource || !key) continue;

    const previous = displayByResource.get(resource);

    if (previous && normalize(previous) !== key) {
      conflictingResources.add(resource);
    }

    displayByResource.set(resource, display);

    const owners = resourcesByDisplay.get(key) ??
      new Set<string>();

    owners.add(resource);
    resourcesByDisplay.set(key, owners);
  }

  return reviews.flatMap((review) => {
    const resource = review.location_name?.trim() ?? "";
    const display = displayByResource.get(resource);

    if (!display || conflictingResources.has(resource)) {
      return [];
    }

    if (resourcesByDisplay.get(normalize(display))?.size !== 1) {
      return [];
    }

    return [{ ...review, location_name: display }];
  });
}

// Never infer a Google provider ID from an unverified restaurant label.
// A label or resource identifier must resolve to exactly one connected entry.
export function resolveUniqueConnectedGoogleLocation(
  locations: readonly ConnectedGoogleReviewLocation[],
  locationName: string,
): string | null {
  const wanted = typeof locationName === "string"
    ? locationName.trim().toLowerCase()
    : "";
  if (!wanted) return null;

  const matches = locations.filter((location) => {
    if (typeof location?.name !== "string" || !location.name.trim()) {
      return false;
    }
    const resource = location.name.trim().toLowerCase();
    const title = typeof location.title === "string"
      ? location.title.trim().toLowerCase()
      : "";
    return wanted === resource || (title.length > 0 && wanted === title);
  });

  return matches.length === 1 ? matches[0].name.trim() : null;
}
