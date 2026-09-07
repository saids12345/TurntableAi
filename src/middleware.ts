// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/", // homepage
  "/login",
  "/privacy",
  "/terms",
  "/upgrade",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;

  // allow auth callback + static assets + common public files
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;

  return false;
}

function isToolPath(pathname: string) {
  // These are your paid features (add/remove as needed)
  return (
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/social") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/integrations")
  );
}

function buildLoginRedirectUrl(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search; // includes leading "?"
  const redirect = `${pathname}${search}`;
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?redirect=${encodeURIComponent(redirect)}`;
  return url;
}

function buildBillingRedirectUrl(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;
  const next = `${pathname}${search}`;
  const url = req.nextUrl.clone();
  url.pathname = "/billing";
  url.search = `?next=${encodeURIComponent(next)}`;
  return url;
}

function isAllowedProStatus(status?: string | null) {
  // treat these Stripe statuses as "unlocked"
  return status === "trialing" || status === "active" || status === "past_due";
}

export async function middleware(request: NextRequest) {
  // Don't run middleware on Stripe webhook (signature/raw body safety)
  if (request.nextUrl.pathname.startsWith("/api/stripe/webhook")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // IMPORTANT:
        // 1) set cookies on the response so browser persists them
        // 2) also set on request cookies so subsequent reads in this same middleware run see them
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh/rehydrate session (this is what keeps users signed in on refresh)
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const pathname = request.nextUrl.pathname;

  // 1) If not signed in, block protected routes
  if (!user) {
    if (isPublicPath(pathname)) return response;

    // features + billing require login
    if (isToolPath(pathname) || pathname.startsWith("/billing")) {
      return NextResponse.redirect(buildLoginRedirectUrl(request));
    }

    // default: allow other pages if you want them public
    return response;
  }

  // 2) Signed in:
  //    - If user hits /login, send them to billing (billing will decide next step)
  if (pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/billing";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3) For feature pages, enforce paywall.
  //    If not pro/trialing, force them through billing.
  if (isToolPath(pathname)) {
    // Read their profile (must have RLS that allows user to read own row)
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_pro, stripe_subscription_status, plan")
      .eq("id", user.id)
      .maybeSingle();

    // If profile missing or query failed, be safe: send to billing
    if (error || !profile) {
      return NextResponse.redirect(buildBillingRedirectUrl(request));
    }

    const unlocked =
      profile.is_pro === true || isAllowedProStatus(profile.stripe_subscription_status);

    if (!unlocked) {
      return NextResponse.redirect(buildBillingRedirectUrl(request));
    }
  }

  // 4) Billing is always allowed (it’s the “gate” page)
  return response;
}

export const config = {
  matcher: [
    // Run on everything except Next static/image + favicon
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
