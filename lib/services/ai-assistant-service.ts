import type { AIAssistantMessage, AIAssistantResult } from "@/lib/types/ai-assistant";

export async function sendAIMessage(
  patientFhirId: string,
  message: string,
  conversationHistory: AIAssistantMessage[]
): Promise<AIAssistantResult> {
  try {
    const response = await fetch("/api/ai-assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientFhirId, message, conversationHistory }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "AI assistant request failed" };
    }

    if (!data.response) {
      return { success: false, error: "Invalid response from AI assistant" };
    }

    return { success: true, data: data.response };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
