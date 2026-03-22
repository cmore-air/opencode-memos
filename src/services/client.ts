import { log } from "./logger.js";
import { MEMOS_API_KEY, MEMOS_USER_ID, MEMOS_CHANNEL, CONFIG } from "../config.js";
import type {
  AddMessageRequest,
  AddMessageResponse,
  SearchMemoryResponse,
  GetMemoryResponse,
  DeleteMemoryResponse,
  AddFeedbackRequest,
  AddFeedbackResponse,
} from "../types/index.js";

const TIMEOUT_MS = 30000;

export interface MemOSClientResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
  code?: number;
  message?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function memOSFetch<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<MemOSClientResponse<T>> {
  if (!MEMOS_API_KEY || !MEMOS_USER_ID || !MEMOS_CHANNEL) {
    return { success: false, error: "mem-os not configured: missing MEMOS_API_KEY, MEMOS_USER_ID, or MEMOS_CHANNEL" };
  }

  const url = `${CONFIG.baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Token ${MEMOS_API_KEY}`,
  };

  body.user_id = MEMOS_USER_ID;
  body.channel = MEMOS_CHANNEL;

  try {
    const response = await withTimeout(
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
      TIMEOUT_MS
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      log(`MemOS API error: ${response.status} ${response.statusText}`, { endpoint, error: errorText });
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result = await response.json() as { code: number; data: T; message: string };
    return { 
      success: result.code === 0, 
      data: result.data, 
      code: result.code, 
      message: result.message 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`MemOS fetch error: ${errorMessage}`, { endpoint });
    return { success: false, error: errorMessage };
  }
}

export class MemOSClient {
  async addMessage(request: AddMessageRequest): Promise<MemOSClientResponse<AddMessageResponse>> {
    log("MemOSClient.addMessage: start", { conversationId: request.conversation_id });
    return memOSFetch<AddMessageResponse>("/add/message", request as unknown as Record<string, unknown>);
  }

  async searchMemory(
    query: string,
    conversationId?: string,
    options?: { limit?: number; relativity?: number }
  ): Promise<MemOSClientResponse<SearchMemoryResponse>> {
    log("MemOSClient.searchMemory: start", { query, conversationId });
    const body: Record<string, unknown> = {
      query,
      conversation_id: conversationId,
      ...options,
    };
    return memOSFetch<SearchMemoryResponse>("/search/memory", body);
  }

  async getMemory(
    options?: { page?: number; size?: number }
  ): Promise<MemOSClientResponse<GetMemoryResponse>> {
    log("MemOSClient.getMemory: start", { options });
    const body: Record<string, unknown> = { ...options };
    return memOSFetch<GetMemoryResponse>("/get/memory", body);
  }

  async deleteMemory(
    memoryIds: string[]
  ): Promise<MemOSClientResponse<DeleteMemoryResponse>> {
    log("MemOSClient.deleteMemory: start", { memoryIds });
    const body: Record<string, unknown> = { memory_ids: memoryIds };
    return memOSFetch<DeleteMemoryResponse>("/delete/memory", body);
  }

  async addFeedback(request: AddFeedbackRequest): Promise<MemOSClientResponse<AddFeedbackResponse>> {
    log("MemOSClient.addFeedback: start", { conversationId: request.conversation_id });
    return memOSFetch<AddFeedbackResponse>("/add/feedback", request as unknown as Record<string, unknown>);
  }
}

export const memOSClient = new MemOSClient();
