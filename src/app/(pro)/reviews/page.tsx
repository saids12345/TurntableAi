"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { track } from "@/lib/track";

type Severity = "low" | "medium" | "high";
type ReviewStatus = "new" | "drafted" | "escalated" | "resolved";
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

type ReviewItem = {
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

type LiveReviewRow = {
  id: string;
  location_name: string | null;
  rating: number | null;
  text: string | null;
  reviewer_name?: string | null;
  author_name?: string | null;
  source?: string | null;
  platform?: string | null;
  create_time?: string | null;
  update_time?: string | null;
};

type WorkflowStateRow = {
  id: string;
  user_id: string;
  review_id: string;
  status: ReviewStatus;
  note: string;
  suggested_reply: string;
  created_at: string;
  updated_at: string;
};

const INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: "rev_1",
    locationName: "Mira Mesa",
    platform: "Google",
    reviewerName: "Sarah M.",
    rating: 2,
    reviewText:
      "Coffee was okay but the wait took way too long and the staff looked overwhelmed. Definitely not the usual experience I expected.",
    createdAt: "2026-03-09T08:20:00.000Z",
    severity: "high",
    status: "new",
    issueType: "wait_time",
    suggestedReply:
      "Thanks for sharing this feedback, Sarah. We’re sorry the wait felt longer than it should have. We’re reviewing service flow with the team and would appreciate the chance to make this right — please reach out to us directly.",
    note: "",
    priorityScore: 82,
    priorityLabel: "high",
    priorityReason: "2-star review, high severity, not handled yet, very recent",
  },
  {
    id: "rev_2",
    locationName: "Escondido",
    platform: "Google",
    reviewerName: "Daniel R.",
    rating: 1,
    reviewText:
      "Order came out wrong and nobody fixed it properly. Really frustrating experience.",
    createdAt: "2026-03-09T07:10:00.000Z",
    severity: "high",
    status: "drafted",
    issueType: "wrong_order",
    suggestedReply:
      "Daniel, we’re sorry to hear your order was not handled correctly. That’s not the experience we want anyone to have. Please contact us directly so we can follow up and make this right.",
    note: "Draft ready. Needs manager approval before posting.",
    priorityScore: 88,
    priorityLabel: "urgent",
    priorityReason: "1-star review, high severity, sensitive issue type, very recent",
  },
  {
    id: "rev_3",
    locationName: "La Jolla",
    platform: "Yelp",
    reviewerName: "Tina K.",
    rating: 4,
    reviewText:
      "Nice atmosphere and friendly team. Drink was good, but it took a bit longer than expected.",
    createdAt: "2026-03-08T18:30:00.000Z",
    severity: "medium",
    status: "new",
    issueType: "wait_time",
    suggestedReply:
      "Thanks for the kind words, Tina — we’re glad you enjoyed the atmosphere and your drink. We also appreciate the note on timing and are working to keep service faster and smoother.",
    note: "",
    priorityScore: 28,
    priorityLabel: "low",
    priorityReason: "not handled yet",
  },
  {
    id: "rev_4",
    locationName: "Chula Vista",
    platform: "Google",
    reviewerName: "Leo P.",
    rating: 5,
    reviewText:
      "Great service, clean space, and the latte was excellent. Will be back.",
    createdAt: "2026-03-08T14:05:00.000Z",
    severity: "low",
    status: "resolved",
    issueType: "general",
    suggestedReply:
      "Thank you so much, Leo. We’re glad you enjoyed the service, the space, and your latte. We appreciate the support and look forward to seeing you again soon.",
    note: "Resolved. Positive review handled.",
    priorityScore: 0,
    priorityLabel: "low",
    priorityReason: "low operational urgency",
  },
  {
    id: "rev_5",
    locationName: "Mira Mesa",
    platform: "Yelp",
    reviewerName: "Amina H.",
    rating: 2,
    reviewText:
      "The pastries tasted stale and the place didn’t feel very clean this visit.",
    createdAt: "2026-03-08T11:42:00.000Z",
    severity: "high",
    status: "escalated",
    issueType: "cleanliness",
    suggestedReply:
      "Amina, we’re sorry this visit missed the mark. Your feedback on freshness and cleanliness is important, and we’re reviewing it with the team immediately. Please reach out directly so we can follow up with you.",
    note: "Escalated to owner. Needs in-store follow-up.",
    priorityScore: 95,
    priorityLabel: "urgent",
    priorityReason: "2-star review, high severity, already escalated, sensitive issue type",
  },
  {
    id: "rev_6",
    locationName: "Escondido",
    platform: "Google",
    reviewerName: "Marcus J.",
    rating: 3,
    reviewText:
      "Food was decent but pricing feels a bit high for the portion size.",
    createdAt: "2026-03-08T09:18:00.000Z",
    severity: "medium",
    status: "new",
    issueType: "pricing",
    suggestedReply:
      "Thanks for taking the time to share this, Marcus. We appreciate the honest feedback on value and portion size, and we’ll keep it in mind as we review the guest experience.",
    note: "",
    priorityScore: 44,
    priorityLabel: "normal",
    priorityReason: "3-star review, not handled yet",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function severityStyles(severity: Severity) {
  if (severity === "high") {
    return "border border-rose-500/20 bg-rose-500/15 text-rose-300";
  }
  if (severity === "medium") {
    return "border border-amber-500/20 bg-amber-500/15 text-amber-300";
  }
  return "border border-sky-500/20 bg-sky-500/15 text-sky-300";
}

function statusStyles(status: ReviewStatus) {
  if (status === "resolved") {
    return "border border-emerald-500/20 bg-emerald-500/15 text-emerald-300";
  }
  if (status === "escalated") {
    return "border border-rose-500/20 bg-rose-500/15 text-rose-300";
  }
  if (status === "drafted") {
    return "border border-amber-500/20 bg-amber-500/15 text-amber-300";
  }
  return "border border-white/10 bg-white/10 text-white/80";
}

function priorityStyles(priority: PriorityLabel) {
  if (priority === "urgent") {
    return "border border-rose-500/30 bg-rose-500/15 text-rose-200";
  }
  if (priority === "high") {
    return "border border-orange-500/30 bg-orange-500/15 text-orange-200";
  }
  if (priority === "normal") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
  return "border border-sky-500/20 bg-sky-500/10 text-sky-200";
}

function issueLabel(issue: IssueType) {
  switch (issue) {
    case "wait_time":
      return "Wait time";
    case "food_quality":
      return "Food quality";
    case "staff_behavior":
      return "Staff behavior";
    case "wrong_order":
      return "Wrong order";
    case "cleanliness":
      return "Cleanliness";
    case "pricing":
      return "Pricing";
    default:
      return "General";
  }
}

function sortReviews(items: ReviewItem[]) {
  return [...items].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    const severityRank = { high: 0, medium: 1, low: 2 };
    const statusRank = { new: 0, drafted: 1, escalated: 2, resolved: 3 };

    const primary = severityRank[a.severity] - severityRank[b.severity];
    if (primary !== 0) return primary;

    const secondary = statusRank[a.status] - statusRank[b.status];
    if (secondary !== 0) return secondary;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function SummaryCard(props: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        {props.label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{props.value}</div>
      {props.sub ? <div className="mt-1 text-sm text-neutral-500">{props.sub}</div> : null}
    </div>
  );
}

function detectIssueType(text: string, rating: number): IssueType {
  const value = text.toLowerCase();

  if (
    value.includes("wait") ||
    value.includes("slow") ||
    value.includes("delay") ||
    value.includes("line") ||
    value.includes("late")
  ) {
    return "wait_time";
  }

  if (
    value.includes("wrong order") ||
    value.includes("incorrect") ||
    value.includes("missing") ||
    value.includes("forgot") ||
    value.includes("mixed up")
  ) {
    return "wrong_order";
  }

  if (
    value.includes("dirty") ||
    value.includes("messy") ||
    value.includes("bathroom") ||
    value.includes("cleanliness")
  ) {
    return "cleanliness";
  }

  if (
    value.includes("rude") ||
    value.includes("staff") ||
    value.includes("employee") ||
    value.includes("service")
  ) {
    return "staff_behavior";
  }

  if (
    value.includes("stale") ||
    value.includes("cold") ||
    value.includes("burnt") ||
    value.includes("taste") ||
    value.includes("flavor") ||
    value.includes("quality")
  ) {
    return "food_quality";
  }

  if (
    value.includes("expensive") ||
    value.includes("overpriced") ||
    value.includes("price") ||
    value.includes("cost")
  ) {
    return "pricing";
  }

  if (rating <= 3) return "general";
  return "general";
}

function deriveSeverity(rating: number, text: string): Severity {
  const value = text.toLowerCase();

  if (
    rating <= 2 ||
    value.includes("wrong order") ||
    value.includes("rude") ||
    value.includes("dirty") ||
    value.includes("stale")
  ) {
    return "high";
  }

  if (rating === 3 || value.includes("wait") || value.includes("slow") || value.includes("price")) {
    return "medium";
  }

  return "low";
}

function deriveSuggestedReply(params: {
  reviewerName: string;
  issueType: IssueType;
  rating: number;
}) {
  const { reviewerName, issueType, rating } = params;
  const safeName = reviewerName || "there";

  switch (issueType) {
    case "wait_time":
      return `Thanks for sharing this feedback, ${safeName}. We’re sorry the wait felt longer than it should have. We’re reviewing service flow with the team and appreciate you calling this out.`;
    case "wrong_order":
      return `${safeName}, we’re sorry your order was not handled correctly. That is not the experience we want anyone to have. Please reach out directly so we can follow up and make this right.`;
    case "cleanliness":
      return `${safeName}, we’re sorry this visit missed the mark. Your feedback on cleanliness is important, and we’re reviewing it with the team immediately.`;
    case "staff_behavior":
      return `Thanks for taking the time to share this, ${safeName}. We’re sorry the service experience did not feel right, and we’re addressing it with the team.`;
    case "food_quality":
      return `${safeName}, we’re sorry to hear the quality did not meet expectations. We’re reviewing this with the team and appreciate the honest feedback.`;
    case "pricing":
      return `Thanks for sharing your feedback, ${safeName}. We appreciate the note on value and are keeping it in mind as we review the guest experience.`;
    default:
      return rating >= 4
        ? `Thank you so much, ${safeName}. We appreciate the support and are glad you took the time to share your experience.`
        : `Thanks for taking the time to share this, ${safeName}. We appreciate the honest feedback and are reviewing it with the team.`;
  }
}

function normalizePlatform(value: string | null | undefined): Platform {
  const lower = (value || "").toLowerCase();
  if (lower.includes("yelp")) return "Yelp";
  return "Google";
}

function hoursSince(iso: string | null | undefined) {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function buildPriority(params: {
  rating: number;
  severity: Severity;
  status: ReviewStatus;
  issueType: IssueType;
  createdAt: string;
  reviewText: string;
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

function normalizeLiveReview(row: LiveReviewRow): ReviewItem {
  const rating = typeof row.rating === "number" ? row.rating : 0;
  const reviewText = row.text?.trim() || "No review text available.";
  const reviewerName = row.reviewer_name?.trim() || row.author_name?.trim() || "Guest";
  const issueType = detectIssueType(reviewText, rating);
  const severity = deriveSeverity(rating, reviewText);
  const createdAt = row.update_time || row.create_time || new Date().toISOString();
  const priority = buildPriority({
    rating,
    severity,
    status: "new",
    issueType,
    createdAt,
    reviewText,
  });

  return {
    id: row.id,
    locationName: row.location_name?.trim() || "Unknown location",
    platform: normalizePlatform(row.platform || row.source),
    reviewerName,
    rating,
    reviewText,
    createdAt,
    severity,
    status: "new",
    issueType,
    suggestedReply: deriveSuggestedReply({
      reviewerName,
      issueType,
      rating,
    }),
    note: "",
    priorityScore: priority.priorityScore,
    priorityLabel: priority.priorityLabel,
    priorityReason: priority.priorityReason,
  };
}

function mergeWorkflowState(
  reviews: ReviewItem[],
  workflowRows: WorkflowStateRow[]
): ReviewItem[] {
  const workflowMap = new Map(workflowRows.map((row) => [row.review_id, row]));

  return reviews.map((review) => {
    const workflow = workflowMap.get(review.id);
    if (!workflow) return review;

    const nextStatus = workflow.status ?? review.status;
    const nextReply =
      workflow.suggested_reply?.trim() ? workflow.suggested_reply : review.suggestedReply;
    const nextNote = workflow.note ?? review.note;
    const nextPriority = buildPriority({
      rating: review.rating,
      severity: review.severity,
      status: nextStatus,
      issueType: review.issueType,
      createdAt: review.createdAt,
      reviewText: review.reviewText,
    });

    return {
      ...review,
      status: nextStatus,
      note: nextNote,
      suggestedReply: nextReply,
      priorityScore: nextPriority.priorityScore,
      priorityLabel: nextPriority.priorityLabel,
      priorityReason: nextPriority.priorityReason,
    };
  });
}

export default function ReviewMonitoringPage() {
  const { push } = useToast();
  const searchParams = useSearchParams();

  const [reviews, setReviews] = useState<ReviewItem[]>(INITIAL_REVIEWS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_REVIEWS[0]?.id ?? "");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        setLiveLoading(true);
        setLiveError(null);

        const [reviewsRes, workflowRes] = await Promise.all([
          fetch("/api/operator-snapshot/reviews", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          }),
          fetch("/api/review-workflow", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          }),
        ]);

        if (!reviewsRes.ok) {
          const text = await reviewsRes.text();
          throw new Error(text || "Failed to load live reviews");
        }

        if (!workflowRes.ok) {
          const text = await workflowRes.text();
          throw new Error(text || "Failed to load review workflow state");
        }

        const reviewsJson = (await reviewsRes.json()) as {
          reviews?: LiveReviewRow[];
        };

        const workflowJson = (await workflowRes.json()) as {
          items?: WorkflowStateRow[];
        };

        const liveRows = Array.isArray(reviewsJson.reviews) ? reviewsJson.reviews : [];
        const workflowRows = Array.isArray(workflowJson.items) ? workflowJson.items : [];

        const normalized = liveRows
          .map(normalizeLiveReview)
          .filter((item) => item.locationName && item.id);

        if (normalized.length > 0) {
          const merged = mergeWorkflowState(normalized, workflowRows);
          const sorted = sortReviews(merged);
          setReviews(sorted);
          setSelectedId(sorted[0]?.id ?? "");
          setUsingLiveData(true);
        } else {
          const mergedFallback = mergeWorkflowState(INITIAL_REVIEWS, workflowRows);
          const sorted = sortReviews(mergedFallback);
          setReviews(sorted);
          setSelectedId(sorted[0]?.id ?? "");
          setUsingLiveData(false);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load live reviews";
        setLiveError(message);
        setUsingLiveData(false);
      } finally {
        setLiveLoading(false);
      }
    }

    void loadAll();
  }, []);

  useEffect(() => {
    const location = searchParams.get("location");
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");
    const searchText = searchParams.get("search");

    setLocationFilter(location?.trim() ? location : "all");

    if (severity === "high" || severity === "medium" || severity === "low") {
      setSeverityFilter(severity);
    } else {
      setSeverityFilter("all");
    }

    if (
      status === "new" ||
      status === "drafted" ||
      status === "escalated" ||
      status === "resolved"
    ) {
      setStatusFilter(status);
    } else {
      setStatusFilter("all");
    }

    if (platform === "Google" || platform === "Yelp") {
      setPlatformFilter(platform);
    } else {
      setPlatformFilter("all");
    }

    setSearch(searchText?.trim() ?? "");
  }, [searchParams]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const matchesLocation =
        locationFilter === "all" || review.locationName === locationFilter;
      const matchesPlatform =
        platformFilter === "all" || review.platform === platformFilter;
      const matchesSeverity =
        severityFilter === "all" || review.severity === severityFilter;
      const matchesStatus = statusFilter === "all" || review.status === statusFilter;
      const matchesSearch =
        search.trim() === "" ||
        review.reviewText.toLowerCase().includes(search.toLowerCase()) ||
        review.reviewerName.toLowerCase().includes(search.toLowerCase()) ||
        review.locationName.toLowerCase().includes(search.toLowerCase());

      return (
        matchesLocation &&
        matchesPlatform &&
        matchesSeverity &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [reviews, locationFilter, platformFilter, severityFilter, statusFilter, search]);

  const sortedFilteredReviews = useMemo(() => {
    return sortReviews(filteredReviews);
  }, [filteredReviews]);

  const selectedReview =
    sortedFilteredReviews.find((review) => review.id === selectedId) ??
    sortedFilteredReviews[0] ??
    null;

  useEffect(() => {
    if (sortedFilteredReviews.length === 0) {
      if (selectedId !== "") setSelectedId("");
      return;
    }

    const selectedStillVisible = sortedFilteredReviews.some((review) => review.id === selectedId);

    if (!selectedStillVisible) {
      setSelectedId(sortedFilteredReviews[0].id);
    }
  }, [sortedFilteredReviews, selectedId]);

  const summary = useMemo(() => {
    const openCount = reviews.filter((r) => r.status === "new").length;
    const highRisk = reviews.filter((r) => r.severity === "high").length;
    const escalated = reviews.filter((r) => r.status === "escalated").length;
    const drafted = reviews.filter((r) => r.status === "drafted").length;

    return { openCount, highRisk, escalated, drafted };
  }, [reviews]);

  const locations = useMemo(() => {
    return Array.from(new Set(reviews.map((r) => r.locationName))).sort();
  }, [reviews]);

  function updateSelectedReviewLocal(patch: Partial<ReviewItem>) {
    if (!selectedReview) return;

    setReviews((current) =>
      current.map((review) => {
        if (review.id !== selectedReview.id) return review;

        const updated: ReviewItem = { ...review, ...patch };
        const nextPriority = buildPriority({
          rating: updated.rating,
          severity: updated.severity,
          status: updated.status,
          issueType: updated.issueType,
          createdAt: updated.createdAt,
          reviewText: updated.reviewText,
        });

        return {
          ...updated,
          priorityScore: nextPriority.priorityScore,
          priorityLabel: nextPriority.priorityLabel,
          priorityReason: nextPriority.priorityReason,
        };
      })
    );
  }

  async function persistReviewState(next: {
    reviewId: string;
    status?: ReviewStatus;
    note?: string;
    suggestedReply?: string;
  }) {
    try {
      setSavingReviewId(next.reviewId);

      const current = reviews.find((r) => r.id === next.reviewId);
      if (!current) return false;

      const res = await fetch("/api/review-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: next.reviewId,
          status: next.status ?? current.status,
          note: next.note ?? current.note,
          suggestedReply: next.suggestedReply ?? current.suggestedReply,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save review workflow state");
      }

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save review workflow state";
      push({ msg: message, type: "error" });
      return false;
    } finally {
      setSavingReviewId(null);
    }
  }

  function clearFilters() {
    setLocationFilter("all");
    setPlatformFilter("all");
    setSeverityFilter("all");
    setStatusFilter("all");
    setSearch("");
  }

  async function copyReply(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      push({ msg: "Reply copied", type: "success" });
    } catch {
      push({ msg: "Could not copy reply", type: "error" });
    }
  }

  async function markStatus(status: ReviewStatus) {
    if (!selectedReview) return;

    updateSelectedReviewLocal({ status });

    const ok = await persistReviewState({
      reviewId: selectedReview.id,
      status,
    });

    if (!ok) return;

    track({
      ts: Date.now(),
      type: "review_status_changed",
      meta: {
        reviewId: selectedReview.id,
        location: selectedReview.locationName,
        nextStatus: status,
      },
    });

    push({ msg: `Review marked as ${status.replace("_", " ")}`, type: "success" });
  }

  async function saveNote() {
    if (!selectedReview) return;

    const ok = await persistReviewState({
      reviewId: selectedReview.id,
      note: selectedReview.note,
    });

    if (!ok) return;

    track({
      ts: Date.now(),
      type: "review_note_saved",
      meta: {
        reviewId: selectedReview.id,
        location: selectedReview.locationName,
      },
    });

    push({ msg: "Internal note saved", type: "success" });
  }

  async function saveReply() {
    if (!selectedReview) return;

    const ok = await persistReviewState({
      reviewId: selectedReview.id,
      status: "drafted",
      suggestedReply: selectedReview.suggestedReply,
    });

    if (!ok) return;

    push({ msg: "Reply draft saved", type: "success" });
  }

  return (
    <div className="min-h-screen w-full px-4 pb-12 pt-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Reputation Operations
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Review Monitoring
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400 md:text-base">
                Monitor review risk, respond faster, and manage guest issues across every location
                from one queue.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {liveLoading && (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    Loading live reviews…
                  </span>
                )}

                {!liveLoading && usingLiveData && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    Live reviews loaded
                  </span>
                )}

                {!liveLoading && !usingLiveData && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                    Using fallback review data
                  </span>
                )}

                {locationFilter !== "all" && (
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                    Focus: {locationFilter}
                  </span>
                )}
                {severityFilter !== "all" && (
                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                    Severity: {severityFilter}
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                    Status: {statusFilter}
                  </span>
                )}
                {platformFilter !== "all" && (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    Platform: {platformFilter}
                  </span>
                )}
                {search.trim() !== "" && (
                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
                    Search: {search}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={clearFilters}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Clear Filters
              </button>
              <Link
                href="/command-center"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Back to Command Center
              </Link>
              <Link
                href="/integrations"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.02]"
              >
                Manage Integrations →
              </Link>
            </div>
          </div>
        </div>

        {liveError ? (
          <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {liveError}
          </div>
        ) : null}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="New reviews"
            value={summary.openCount}
            sub="Waiting for response or triage"
          />
          <SummaryCard
            label="High-risk reviews"
            value={summary.highRisk}
            sub="Needs fast attention"
          />
          <SummaryCard
            label="Escalated issues"
            value={summary.escalated}
            sub="Owner or manager follow-up"
          />
          <SummaryCard
            label="Drafted replies"
            value={summary.drafted}
            sub="Ready for approval"
          />
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Queue Filters</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Narrow the queue by location, platform, severity, status, or search.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <div className="mb-1.5 text-xs font-medium text-neutral-300">Location</div>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/60"
              >
                <option value="all">All locations</option>
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-xs font-medium text-neutral-300">Platform</div>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/60"
              >
                <option value="all">All platforms</option>
                <option value="Google">Google</option>
                <option value="Yelp">Yelp</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-xs font-medium text-neutral-300">Severity</div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/60"
              >
                <option value="all">All severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-xs font-medium text-neutral-300">Status</div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/60"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="drafted">Drafted</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-xs font-medium text-neutral-300">Search</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search review text or location"
                className="w-full rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-violet-500/60"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr,1.35fr]">
          <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Review Queue</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Prioritized by severity and filtered by your current view.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-400">
                {sortedFilteredReviews.length} match{sortedFilteredReviews.length === 1 ? "" : "es"}
              </div>
            </div>

            <div className="space-y-3">
              {sortedFilteredReviews.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-5 text-sm text-neutral-400">
                  No reviews match the current filters.
                </div>
              ) : (
                sortedFilteredReviews.map((review) => (
                  <button
                    key={review.id}
                    onClick={() => {
                      setSelectedId(review.id);
                      track({
                        ts: Date.now(),
                        type: "review_card_opened",
                        meta: {
                          reviewId: review.id,
                          location: review.locationName,
                          severity: review.severity,
                          priority: review.priorityLabel,
                        },
                      });
                    }}
                    className={cx(
                      "w-full rounded-2xl border p-4 text-left transition",
                      selectedReview?.id === review.id
                        ? "border-violet-400/50 bg-violet-500/10"
                        : "border-white/10 bg-neutral-900/50 hover:bg-white/5"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                            priorityStyles(review.priorityLabel)
                          )}
                        >
                          {review.priorityLabel}
                        </span>
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                            severityStyles(review.severity)
                          )}
                        >
                          {review.severity}
                        </span>
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                            statusStyles(review.status)
                          )}
                        >
                          {review.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500">{formatWhen(review.createdAt)}</div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {review.locationName} · {review.platform}
                        </div>
                        <div className="mt-1 text-xs text-neutral-400">
                          {review.reviewerName} · {review.rating}★ · {issueLabel(review.issueType)}
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm text-neutral-300">{review.reviewText}</p>

                    <div className="mt-2 text-xs text-neutral-500">
                      Priority reason: {review.priorityReason}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
            {selectedReview ? (
              <>
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Review Detail</h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Review detail, issue context, and response workflow.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                        priorityStyles(selectedReview.priorityLabel)
                      )}
                    >
                      {selectedReview.priorityLabel}
                    </span>
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                        severityStyles(selectedReview.severity)
                      )}
                    >
                      {selectedReview.severity}
                    </span>
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                        statusStyles(selectedReview.status)
                      )}
                    >
                      {selectedReview.status.replace("_", " ")}
                    </span>
                    {savingReviewId === selectedReview.id && (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                        Saving
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Location
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {selectedReview.locationName}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Platform
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {selectedReview.platform}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Rating
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {selectedReview.rating}★
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Issue type
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {issueLabel(selectedReview.issueType)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Priority
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {selectedReview.priorityLabel} ({selectedReview.priorityScore})
                    </div>
                    <div className="mt-1 text-xs text-neutral-400">
                      {selectedReview.priorityReason}
                    </div>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                  <div className="mb-2 text-sm font-semibold text-white">Customer review</div>
                  <div className="text-sm leading-6 text-neutral-300">{selectedReview.reviewText}</div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white">Recommended Reply</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyReply(selectedReview.suggestedReply)}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
                          >
                            Copy reply
                          </button>
                          <button
                            onClick={saveReply}
                            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-500/15"
                          >
                            Save draft
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={selectedReview.suggestedReply}
                        onChange={(e) =>
                          updateSelectedReviewLocal({
                            suggestedReply: e.target.value,
                            status: "drafted",
                          })
                        }
                        className="h-48 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/60"
                      />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                      <div className="mb-2 text-sm font-semibold text-white">Internal note</div>
                      <textarea
                        value={selectedReview.note}
                        onChange={(e) => updateSelectedReviewLocal({ note: e.target.value })}
                        placeholder="Add internal context, follow-up notes, or approval details..."
                        className="h-32 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-violet-500/60"
                      />
                      <div className="mt-3">
                        <button
                          onClick={saveNote}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                        >
                          Save note
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                      <div className="mb-3 text-sm font-semibold text-white">Response Actions</div>
                      <div className="grid gap-3">
                        <button
                          onClick={() => markStatus("drafted")}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                        >
                          Mark as Drafted
                        </button>
                        <button
                          onClick={() => markStatus("escalated")}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-500/15"
                        >
                          Escalate to Manager
                        </button>
                        <button
                          onClick={() => markStatus("resolved")}
                          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/15"
                        >
                          Mark as Resolved
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                      <div className="mb-3 text-sm font-semibold text-white">Issue snapshot</div>
                      <div className="space-y-3 text-sm text-neutral-300">
                        <div>
                          <span className="text-neutral-500">Reviewer:</span>{" "}
                          {selectedReview.reviewerName}
                        </div>
                        <div>
                          <span className="text-neutral-500">Created:</span>{" "}
                          {formatWhen(selectedReview.createdAt)}
                        </div>
                        <div>
                          <span className="text-neutral-500">Priority:</span>{" "}
                          <span className="capitalize">{selectedReview.priorityLabel}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Status:</span>{" "}
                          <span className="capitalize">
                            {selectedReview.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
                      <div className="mb-3 text-sm font-semibold text-white">Operator guidance</div>
                      <ul className="space-y-2 text-sm text-neutral-300">
                        <li>• Respond fastest to urgent and high-priority reviews first.</li>
                        <li>• Escalate anything tied to repeat operational issues.</li>
                        <li>• Use internal notes to preserve context across managers.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-5 text-sm text-neutral-400">
                No review selected.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}