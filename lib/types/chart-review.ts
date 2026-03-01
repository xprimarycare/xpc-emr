/** Structured payload passed through SidebarContext to trigger a chart review */
export interface ChartReviewRequest {
  noteText: string;
  patientName: string;
  patientDob: string;
  encounterDate: string;
  providerName: string;
}

/** Feedback categories returned by the XPC Chart Review API */
export interface ChartReviewFeedback {
  diagnosis: string[];
  workup: string[];
  treatment: string[];
  follow_up: string[];
  differential_diagnosis: string[];
}

/** The chart_review object inside the XPC 200 response */
export interface ChartReviewData {
  patient: string;
  provider: string;
  key_takeaways: string[];
  feedback: ChartReviewFeedback;
}

/** Client service result type */
export interface ChartReviewResult {
  success: boolean;
  data?: ChartReviewData;
  error?: string;
}
