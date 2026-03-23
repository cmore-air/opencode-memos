import { log, debug } from "./logger.js";
import { MEMOS_API_KEY, MEMOS_USER_ID, MEMOS_CHANNEL, CONFIG } from "../config.js";
import type {
  AddMessageRequest,
  AddMessageResponse,
  SearchMemoryResponse,
  GetMemoryResponse,
  DeleteMemoryResponse,
  AddFeedbackRequest,
  AddFeedbackResponse,
  TaskStatusResponse,
  EnhancedFeedbackRequest,
  EnhancedFeedbackResponse,
  MemoryFilterOptions,
  ChatRequest,
  ChatResponse,
  SuggestRequest,
  SuggestResponse,
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
    return { success: true };
  }

  const url = `${CONFIG.baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Token ${MEMOS_API_KEY}`,
  };

  const requestBody = {
    ...body,
    user_id: MEMOS_USER_ID,
    channel: MEMOS_CHANNEL,
  };

  debug(`MemOS API request: ${endpoint}`, { url, hasBody: !!body });

  try {
    const response = await withTimeout(
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      }),
      TIMEOUT_MS
    );

    debug(`MemOS API response: ${endpoint}`, { status: response.status, statusText: response.statusText });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      log(`MemOS API error: ${response.status} ${response.statusText}`, { endpoint, error: errorText });
      debug(`MemOS API error body: ${endpoint}`, { error: errorText });
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result = await response.json() as { code: number; data: T; message: string };
    debug(`MemOS API response: ${endpoint}`, { code: result.code, message: result.message });
    return { 
      success: result.code === 0, 
      data: result.data, 
      code: result.code, 
      message: result.message 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`MemOS fetch error: ${errorMessage}`, { endpoint });
    debug(`MemOS fetch exception: ${endpoint}`, { error: errorMessage });
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
    options?: MemoryFilterOptions
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

  async getTaskStatus(taskId: string): Promise<MemOSClientResponse<TaskStatusResponse>> {
    log("MemOSClient.getTaskStatus: start", { taskId });
    const body: Record<string, unknown> = { task_id: taskId };
    return memOSFetch<TaskStatusResponse>("/get/status", body);
  }

  async addFeedbackEnhanced(request: EnhancedFeedbackRequest): Promise<MemOSClientResponse<EnhancedFeedbackResponse>> {
    log("MemOSClient.addFeedbackEnhanced: start", { 
      conversationId: request.conversation_id,
      hasMemoryIds: !!request.retrieved_memory_ids?.length,
    });
    return memOSFetch<EnhancedFeedbackResponse>("/product/feedback", request as unknown as Record<string, unknown>);
  }

  async chat(request: ChatRequest): Promise<MemOSClientResponse<ChatResponse>> {
    log("MemOSClient.chat: start", { query: request.query.slice(0, 50) });
    const body: Record<string, unknown> = {
      query: request.query,
      history: request.history,
      readable_cube_ids: request.readable_cube_ids,
      writable_cube_ids: request.writable_cube_ids,
      stream: false,
    };
    return memOSFetch<ChatResponse>("/chat/complete", body);
  }

  async getSuggestions(request: SuggestRequest): Promise<MemOSClientResponse<SuggestResponse>> {
    log("MemOSClient.getSuggestions: start", { 
      conversationId: request.conversation_id,
      historyLength: request.history?.length,
    });
    const body: Record<string, unknown> = {
      conversation_id: request.conversation_id,
      history: request.history,
      count: request.count ?? 3,
    };
    return memOSFetch<SuggestResponse>("/suggestion/queries", body);
  }
}

export const memOSClient = new MemOSClient();
