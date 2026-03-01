/** A single message in the AI conversation (roles match Vertex AI SDK) */
export interface AIAssistantMessage {
  role: 'user' | 'model';
  content: string;
}

/** Request payload sent from client to POST /api/ai-assistant/chat */
export interface AIAssistantRequest {
  patientFhirId: string;
  message: string;
  conversationHistory: AIAssistantMessage[];
}

/** Client service result type */
export type AIAssistantResult =
  | { success: true; data: string }
  | { success: false; error: string };
