import type { AddMessageRequest, AddMessageResponse, SearchMemoryResponse, GetMemoryResponse, DeleteMemoryResponse, AddFeedbackRequest, AddFeedbackResponse, TaskStatusResponse, EnhancedFeedbackRequest, EnhancedFeedbackResponse, MemoryFilterOptions, ChatRequest, ChatResponse, SuggestRequest, SuggestResponse } from "../types/index.js";
export interface MemOSClientResponse<T> {
    success: boolean;
    error?: string;
    data?: T;
    code?: number;
    message?: string;
}
export declare class MemOSClient {
    addMessage(request: AddMessageRequest): Promise<MemOSClientResponse<AddMessageResponse>>;
    searchMemory(query: string, conversationId?: string, options?: MemoryFilterOptions): Promise<MemOSClientResponse<SearchMemoryResponse>>;
    getMemory(options?: {
        page?: number;
        size?: number;
    }): Promise<MemOSClientResponse<GetMemoryResponse>>;
    deleteMemory(memoryIds: string[]): Promise<MemOSClientResponse<DeleteMemoryResponse>>;
    addFeedback(request: AddFeedbackRequest): Promise<MemOSClientResponse<AddFeedbackResponse>>;
    getTaskStatus(taskId: string): Promise<MemOSClientResponse<TaskStatusResponse>>;
    addFeedbackEnhanced(request: EnhancedFeedbackRequest): Promise<MemOSClientResponse<EnhancedFeedbackResponse>>;
    chat(request: ChatRequest): Promise<MemOSClientResponse<ChatResponse>>;
    getSuggestions(request: SuggestRequest): Promise<MemOSClientResponse<SuggestResponse>>;
}
export declare const memOSClient: MemOSClient;
//# sourceMappingURL=client.d.ts.map