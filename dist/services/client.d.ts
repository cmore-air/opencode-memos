import type { AddMessageRequest, AddMessageResponse, SearchMemoryResponse, GetMemoryResponse, DeleteMemoryResponse, AddFeedbackRequest, AddFeedbackResponse } from "../types/index.js";
export interface MemOSClientResponse<T> {
    success: boolean;
    error?: string;
    data?: T;
    code?: number;
    message?: string;
}
export declare class MemOSClient {
    addMessage(request: AddMessageRequest): Promise<MemOSClientResponse<AddMessageResponse>>;
    searchMemory(query: string, conversationId?: string, options?: {
        limit?: number;
        relativity?: number;
    }): Promise<MemOSClientResponse<SearchMemoryResponse>>;
    getMemory(options?: {
        page?: number;
        size?: number;
    }): Promise<MemOSClientResponse<GetMemoryResponse>>;
    deleteMemory(memoryIds: string[]): Promise<MemOSClientResponse<DeleteMemoryResponse>>;
    addFeedback(request: AddFeedbackRequest): Promise<MemOSClientResponse<AddFeedbackResponse>>;
}
export declare const memOSClient: MemOSClient;
//# sourceMappingURL=client.d.ts.map