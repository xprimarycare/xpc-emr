import { ChartReviewRequest, ChartReviewResult } from "@/lib/types/chart-review";

export async function requestChartReview(
  payload: ChartReviewRequest
): Promise<ChartReviewResult> {
  try {
    const response = await fetch("/api/chart-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Chart review failed" };
    }

    if (!data.chart_review) {
      return { success: false, error: "Invalid response from chart review API" };
    }

    return { success: true, data: data.chart_review };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
