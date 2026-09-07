import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

type SavePayload = {
  reviewId: string;
  reply: string;
  tags: string[];
  note: string;
  status?: "drafted" | "approved" | "posted" | "rejected";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SavePayload;

    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("review-save: no user", userError);

      return Response.json(
        { error: "Not signed in" },
        { status: 401 }
      );
    }

    const status = body.status ?? "drafted";

    const insertData = {
      review_id: body.reviewId,
      draft_text: body.reply,
      final_text: body.reply,
      status,
      tags: JSON.stringify(body.tags ?? []),
      note: body.note ?? "",
      posted_at:
        status === "posted"
          ? new Date().toISOString()
          : null,
    };

    const { error } = await supabase
      .from("review_replies")
      .insert(insertData);

    if (error) {
      console.error(error);

      return Response.json(
        {
          error: "Failed to save reply",
          details: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return Response.json({
      ok: true,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Failed to save reply",
      },
      {
        status: 500,
      }
    );
  }
}