import { FhirCommunicationBundle } from "@/lib/types/fhir";
import { AppThread } from "@/lib/types/message";
import {
  mapFhirBundleToThreads,
  mapAppMessageToFhirCommunication,
  buildFhirThreadHeader,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";

// ─── Result types ────────────────────────────────────────

export interface ThreadSearchResult {
  threads: AppThread[];
  error?: string;
}

export interface MessageSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ThreadCreateResult {
  success: boolean;
  threadId?: string;
  error?: string;
}

// ─── Service functions ───────────────────────────────────

/**
 * Fetch all threads and messages for a patient.
 */
export async function searchFhirThreads(
  patientFhirId: string
): Promise<ThreadSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch(
        `/api/clinical/communication?patient=${encodeURIComponent(patientFhirId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        return { threads: [], error: data.error || "Failed to fetch messages" };
      }
      const threads = (data.items || []).map((item: any) => ({ ...item, fhirId: item.id }));
      return { threads };
    } catch (error) {
      return { threads: [], error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/communication?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { threads: [], error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { threads: [], error: data.error || "Failed to fetch messages" };
    }

    const bundle = data as FhirCommunicationBundle;
    const threads = mapFhirBundleToThreads(bundle);

    return { threads };
  } catch (error) {
    return {
      threads: [],
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Create a thread header for a patient.
 */
export async function createFhirThread(
  patientFhirId: string,
  practitionerId: string,
  topic?: string
): Promise<ThreadCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch("/api/clinical/communication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patientFhirId, topic }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to create thread" };
      }
      return { success: true, threadId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const fhirResource = buildFhirThreadHeader(
      `Patient/${patientFhirId}`,
      `Practitioner/${practitionerId}`,
      topic
    );

    const response = await fetch("/api/fhir/communication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirResource),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to create thread" };
    }

    return { success: true, threadId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Send a message in a thread.
 * If no threadId is provided, creates a new thread first.
 */
export async function sendFhirMessage(
  text: string,
  patientFhirId: string,
  practitionerId: string,
  threadId?: string
): Promise<MessageSendResult & { threadId?: string }> {
  if (isLocalBackendClient()) {
    try {
      let actualThreadId = threadId;
      if (!actualThreadId) {
        const threadResult = await createFhirThread(patientFhirId, practitionerId);
        if (!threadResult.success || !threadResult.threadId) {
          return { success: false, error: threadResult.error || "Failed to create thread" };
        }
        actualThreadId = threadResult.threadId;
      }
      const res = await fetch("/api/clinical/communication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: actualThreadId,
          senderType: "provider",
          senderRef: practitionerId,
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to send message" };
      }
      return { success: true, messageId: data.id, threadId: actualThreadId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    // If no thread exists, create one first
    let actualThreadId = threadId;
    if (!actualThreadId) {
      const threadResult = await createFhirThread(patientFhirId, practitionerId);
      if (!threadResult.success || !threadResult.threadId) {
        return { success: false, error: threadResult.error || "Failed to create thread" };
      }
      actualThreadId = threadResult.threadId;
    }

    const fhirResource = mapAppMessageToFhirCommunication({
      text,
      senderRef: `Practitioner/${practitionerId}`,
      recipientRef: `Patient/${patientFhirId}`,
      patientRef: `Patient/${patientFhirId}`,
      threadId: actualThreadId,
    });

    const response = await fetch("/api/fhir/communication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirResource),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to send message" };
    }

    return { success: true, messageId: data.id, threadId: actualThreadId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
