import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type SavePayload = {
  reviewId: string; // id from the `reviews` table
  reply: string; // final reply text
  tags: string[]; // quick tags
  note: string; // internal note
  status?: "drafted" | "approved" | "posted" | "rejected";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SavePayload;

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Make sure user is signed in
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("review-save: no user", userError);
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const status = body.status ?? "drafted";
    const nowIso = new Date().toISOString();

    const insertData: any = {
      review_id: body.reviewId, // FK to reviews.id
      draft_text: body.reply,
      final_text: body.reply,
      status,
      // `tags` column is `text`, so store JSON string
      tags: JSON.stringify(body.tags ?? []),
      note: body.note ?? "",
    };

    if (status === "posted") {
      insertData.posted_at = nowIso;
    }

    const { error } = await supabase.from("review_replies").insert(insertData);

    if (error) {
      console.error("review-save supabase error:", error);
      return Response.json(
        { error: "Failed to save reply", details: error.message },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("review-save route error:", err);
    return Response.json({ error: "Failed to save reply" }, { status: 500 });
  }
}
