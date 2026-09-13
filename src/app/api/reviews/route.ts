import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewStatus = "new" | "drafted" | "escalated" | "resolved";
type Severity = "low" | "medium" | "high";
type Platform = "Google" | "Yelp";
type IssueType =
  | "wait_time"
  | "food_quality"
  | "staff_behavior"
  | "wrong_order"
  | "cleanliness"
  | "pricing"
  | "general";

type PriorityLabel = "urgent" | "high" | "normal" | "low";

type DbReviewRow = {
  id: string;
  location_name: string | null;
  reviewer_name: string | null;
  rating: number | null;
  text: string | null;
  update_time: string | null;
  platform: string | null;
  owner_reply: string | null;
};

type WorkflowRow = {
  id: string;
  user_id: string;
  review_id: string;
  status: ReviewStatus;
  note: string | null;
  suggested_reply: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewApiItem = {
  id: string;
  locationName: string;
  platform: Platform;
  reviewerName: string;
  rating: number;
  reviewText: string;
  createdAt: string;
  severity: Severity;
  status: ReviewStatus;
  issueType: IssueType;
  suggestedReply: string;
  note: string;
  priorityScore: number;
  priorityLabel: PriorityLabel;
  priorityReason: string;
};

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function hoursSince(iso: string | null | undefined) {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function inferSeverity(rating: number, text: string): Severity {
  const lower = text.toLowerCase();

  if (
    rating <= 2 ||
    lower.includes("terrible") ||
    lower.includes("awful") ||
    lower.includes("horrible") ||
    lower.includes("never again") ||
    lower.includes("disgusting")
  ) {
    return "high";
  }

  if (
    rating === 3 ||
    lower.includes("slow") ||
    lower.includes("wait") ||
    lower.includes("delay") ||
    lower.includes("wrong") ||
    lower.includes("dirty") ||
    lower.includes("stale") ||
    lower.includes("cold") ||
    lower.includes("overpriced")
  ) {
    return "medium";
  }

  return "low";
}

function inferIssueType(text: string): IssueType {
  const lower = text.toLowerCase();

  if (
    lower.includes("wait") ||
    lower.includes("slow") ||
    lower.includes("delay") ||
    lower.includes("line") ||
    lower.includes("late")
  ) {
    return "wait_time";
  }

  if (
    lower.includes("wrong order") ||
    lower.includes("incorrect") ||
    lower.includes("missing") ||
    lower.includes("forgot") ||
    lower.includes("mixed up")
  ) {
    return "wrong_order";
  }

  if (
    lower.includes("staff") ||
    lower.includes("employee") ||
    lower.includes("rude") ||
    lower.includes("attitude") ||
    lower.includes("service")
  ) {
    return "staff_behavior";
  }

  if (
    lower.includes("dirty") ||
    lower.includes("messy") ||
    lower.includes("cleanliness") ||
    lower.includes("bathroom")
  ) {
    return "cleanliness";
  }

  if (
    lower.includes("stale") ||
    lower.includes("cold") ||
    lower.includes("burnt") ||
    lower.includes("taste") ||
    lower.includes("flavor") ||
    lower.includes("quality")
  ) {
    return "food_quality";
  }

  if (
    lower.includes("expensive") ||
    lower.includes("overpriced") ||
    lower.includes("price") ||
    lower.includes("pricing") ||
    lower.includes("cost")
  ) {
    return "pricing";
  }

  return "general";
}

function inferStatus(row: DbReviewRow): ReviewStatus {
  const rating = typeof row.rating === "number" ? row.rating : 0;
  const text = (row.text ?? "").toLowerCase();
  const hasReply = Boolean(row.owner_reply && row.owner_reply.trim());

  if (hasReply && rating >= 4) return "resolved";
  if (hasReply) return "drafted";

  if (
    rating <= 2 ||
    text.includes("manager") ||
    text.includes("owner") ||
    text.includes("refund") ||
    text.includes("never again")
  ) {
    return "escalated";
  }

  return "new";
}

function buildSuggestedReply(params: {
  reviewerName: string;
  issueType: IssueType;
}) {
  const { reviewerName, issueType } = params;
  const firstName = reviewerName.split(" ")[0] || "there";

  switch (issueType) {
    case "wait_time":
      return `Thanks for sharing this feedback, ${firstName}. We’re sorry the wait felt longer than it should have. We’re reviewing service flow with the team and appreciate you flagging it for us.`;
    case "wrong_order":
      return `${firstName}, we’re sorry your order was not handled correctly. That’s not the experience we want for our guests, and we’d appreciate the chance to make this right.`;
    case "staff_behavior":
      return `Thank you for the honest feedback, ${firstName}. We’re sorry this interaction missed the standard we aim for, and we’re addressing it with the team.`;
    case "cleanliness":
      return `${firstName}, we’re sorry this visit did not meet expectations. Cleanliness matters a lot to us, and we’re reviewing this with the team right away.`;
    case "food_quality":
      return `Thank you for sharing this, ${firstName}. We’re sorry the product quality missed the mark and are reviewing consistency with the team.`;
    case "pricing":
      return `Thanks for the honest feedback, ${firstName}. We appreciate your note on value and will keep it in mind as we review the guest experience.`;
    default:
      return `Thank you for taking the time to leave feedback, ${firstName}. We appreciate it and are reviewing your experience with the team.`;
  }
}

function normalizePlatform(value: string | null): Platform {
  return value === "Yelp" ? "Yelp" : "Google";
}

function buildPriority(params: {
  rating: number;
  severity: Severity;
  status: ReviewStatus;
  issueType: IssueType;
  createdAt: string;
  reviewText: string;
  locationName: string;
}) {
  const { rating, severity, status, issueType, createdAt, reviewText } = params;

  let score = 0;
  const reasons: string[] = [];
  const lower = reviewText.toLowerCase();
  const ageHours = hoursSince(createdAt);

  if (rating <= 1) {
    score += 50;
    reasons.push("1-star review");
  } else if (rating === 2) {
    score += 40;
    reasons.push("2-star review");
  } else if (rating === 3) {
    score += 20;
    reasons.push("3-star review");
  }

  if (severity === "high") {
    score += 25;
    reasons.push("high severity");
  } else if (severity === "medium") {
    score += 10;
  }

  if (status === "new") {
    score += 20;
    reasons.push("not handled yet");
  } else if (status === "drafted") {
    score += 8;
  } else if (status === "escalated") {
    score += 18;
    reasons.push("already escalated");
  } else if (status === "resolved") {
    score -= 20;
  }

  if (ageHours <= 12) {
    score += 18;
    reasons.push("very recent");
  } else if (ageHours <= 24) {
    score += 12;
  } else if (ageHours <= 72) {
    score += 6;
  }

  if (
    issueType === "wrong_order" ||
    issueType === "staff_behavior" ||
    issueType === "cleanliness"
  ) {
    score += 12;
    reasons.push("sensitive issue type");
  }

  if (
    lower.includes("refund") ||
    lower.includes("charge") ||
    lower.includes("manager") ||
    lower.includes("owner") ||
    lower.includes("never again") ||
    lower.includes("disgusting") ||
    lower.includes("unsafe")
  ) {
    score += 15;
    reasons.push("brand-risk language");
  }

  let label: PriorityLabel = "low";
  if (score >= 85) label = "urgent";
  else if (score >= 60) label = "high";
  else if (score >= 30) label = "normal";

  return {
    priorityScore: score,
    priorityLabel: label,
    priorityReason: reasons.length ? reasons.join(", ") : "low operational urgency",
  };
}

export async function GET() {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sinceIso = daysAgoIso(60);

    const [
      { data: reviewsData, error: reviewsError },
      { data: workflowData, error: workflowError },
    ] = await Promise.all([
      supabase
        .from("reviews")
        .select(
          "id, location_name, reviewer_name, rating, text, update_time, platform, owner_reply"
        )
        .eq("user_id", user.id)
        .gte("update_time", sinceIso)
        .order("update_time", { ascending: false }),
      supabase
        .from("review_workflow_states")
        .select(
          "id, user_id, review_id, status, note, suggested_reply, created_at, updated_at"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);

    if (reviewsError) {
      console.error("api/reviews GET reviews error:", reviewsError);
      return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
    }

    if (workflowError) {
      console.error("api/reviews GET workflow error:", workflowError);
      return NextResponse.json({ error: "Failed to load review workflow state" }, { status: 500 });
    }

    const workflowMap = new Map(
      ((workflowData ?? []) as WorkflowRow[]).map((row) => [row.review_id, row])
    );

    const items: ReviewApiItem[] = ((reviewsData ?? []) as DbReviewRow[]).map((row) => {
      const rating = typeof row.rating === "number" ? row.rating : 0;
      const reviewText = row.text?.trim() || "No review text available.";
      const reviewerName = row.reviewer_name?.trim() || "Guest";
      const issueType = inferIssueType(reviewText);
      const defaultSuggestedReply = buildSuggestedReply({
        reviewerName,
        issueType,
      });
      const workflow = workflowMap.get(row.id);
      const status = workflow?.status ?? inferStatus(row);
      const severity = inferSeverity(rating, reviewText);
      const createdAt = row.update_time || new Date().toISOString();
      const priority = buildPriority({
        rating,
        severity,
        status,
        issueType,
        createdAt,
        reviewText,
        locationName: row.location_name?.trim() || "Unknown Location",
      });

      return {
        id: row.id,
        locationName: row.location_name?.trim() || "Unknown Location",
        platform: normalizePlatform(row.platform),
        reviewerName,
        rating,
        reviewText,
        createdAt,
        severity,
        status,
        issueType,
        suggestedReply:
          workflow?.suggested_reply?.trim() || row.owner_reply?.trim() || defaultSuggestedReply,
        note: workflow?.note ?? "",
        priorityScore: priority.priorityScore,
        priorityLabel: priority.priorityLabel,
        priorityReason: priority.priorityReason,
      };
    });

    items.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      items,
      generatedAt: new Date().toISOString(),
      source: "supabase",
    });
  } catch (error) {
    console.error("api/reviews unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}