import { NextResponse } from "next/server";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...((data as object) || {}) }, init);
}

export function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
