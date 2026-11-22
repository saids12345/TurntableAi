export type LocationDetails = {
  name: string;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

type Result =
  | { ok: true; value: LocationDetails }
  | { ok: false; error: string };

const CONTROL = /[\u0000-\u001F\u007F]/;

export function isLocationId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseLocationDetails(input: unknown): Result {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Enter your location details." };
  }

  const data = input as Record<string, unknown>;
  const allowed = new Set(["name", "city", "region", "countryCode"]);

  if (Object.keys(data).some(key => !allowed.has(key))) {
    return { ok: false, error: "Unexpected location field." };
  }

  if (typeof data.name !== "string") {
    return { ok: false, error: "Enter a location name." };
  }

  const name = data.name.trim();
  if (name.length < 1 || name.length > 160 || CONTROL.test(name)) {
    return { ok: false, error: "Location name must be 1–160 characters." };
  }

  function optionalText(
    value: unknown,
    field: string,
    maxLength: number,
  ): { ok: true; value: string | null } | { ok: false; error: string } {
    if (value === undefined || value === null || value === "") {
      return { ok: true, value: null };
    }
    if (typeof value !== "string") {
      return { ok: false, error: `${field} must be text.` };
    }
    const text = value.trim();
    if (text.length > maxLength || CONTROL.test(text)) {
      return { ok: false, error: `${field} must be ${maxLength} characters or fewer.` };
    }
    return { ok: true, value: text || null };
  }

  const city = optionalText(data.city, "City", 120);
  if (!city.ok) return city;

  const region = optionalText(data.region, "State or region", 120);
  if (!region.ok) return region;

  const country = optionalText(data.countryCode, "Country code", 2);
  if (!country.ok) return country;

  const countryCode = country.value?.toUpperCase() ?? null;
  if (countryCode !== null && !/^[A-Z]{2}$/.test(countryCode)) {
    return { ok: false, error: "Use a two-letter country code." };
  }

  return {
    ok: true,
    value: {
      name,
      city: city.value,
      region: region.value,
      countryCode,
    },
  };
}
