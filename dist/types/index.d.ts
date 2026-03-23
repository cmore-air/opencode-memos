export type MessageRole = "user" | "assistant" | "system" | "tool";
export type MessageContentPart = {
    type: "text";
    text: string;
} | {
    type: "image_url";
    imageUrl: {
        url: string;
    };
} | {
    type: "file";
    file: {
        file_data: string;
    };
};
export interface MemOSMessage {
    role: MessageRole;
    content: string | MessageContentPart[];
    chat_time?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string;
        };
    }>;
}
export interface AddMessageRequest {
    user_id?: string;
    conversation_id: string;
    messages: MemOSMessage[];
    tags?: string[];
    info?: Record<string, unknown>;
    allow_public?: boolean;
    async_mode?: boolean;
    agent_id?: string;
    app_id?: string;
    allow_knowledgebase_ids?: string[];
}
export type MemoryType = "WorkingMemory" | "LongTermMemory" | "UserMemory";
export type PreferenceType = "explicit_preference" | "implicit_preference";
export type ToolMemoryType = "ToolTrajectoryMemory" | "ToolSchema";
export interface MemoryDetail {
    id: string;
    memory_key: string;
    memory_value: string;
    memory_type: MemoryType;
    create_time: string;
    conversation_id: string;
    status: "activated";
    confidence: number;
    tags: string[];
    update_time: string;
    relativity: number;
}
export interface PreferenceDetail {
    id: string;
    preference_type: PreferenceType;
    preference: string;
    reasoning: string;
    create_time: string;
    conversation_id: string;
    status: "activated";
    update_time: string;
    relativity: number;
}
export interface ToolMemoryDetail {
    id: string;
    tool_type: ToolMemoryType;
    tool_value: string;
    tool_used_status: Array<{
        used_tool: string;
        error_type?: string;
        success_rate: number;
        tool_experience: string;
    }>;
    create_time: string;
    conversation_id: string;
    status: "activated";
    update_time: string;
    relativity: number;
    experience: string;
}
export interface SearchMemoryResponse {
    memory_detail_list: MemoryDetail[];
    preference_detail_list: PreferenceDetail[];
    tool_memory_detail_list: ToolMemoryDetail[];
    preference_note?: string;
    skill_detail_list: Array<{
        id: string;
        skill_value: {
            name: string;
            description: string;
            procedure: string;
            experience: string[];
            preference: string[];
            examples: string[];
            script: Record<string, unknown>;
            others: Record<string, unknown>;
        };
        skill_url: string;
        skill_type: string;
        create_time: string;
        conversation_id: string;
        status: "activated";
        confidence: number;
        tags: string[];
        update_time: string;
        relativity: string;
    }>;
}
export interface GetMemoryResponse {
    memory_detail_list: MemoryDetail[];
    preference_detail_list: PreferenceDetail[];
    tool_memory_detail_list: ToolMemoryDetail[];
    total: number;
    size: number;
    current: number;
    pages: number;
}
export interface MemOSApiResponse<T> {
    code: number;
    data: T;
    message: string;
}
export interface AddMessageResponse {
    success: boolean;
    task_id: string;
    status: "running" | "completed" | "failed";
}
export interface DeleteMemoryResponse {
    success: boolean;
}
export interface AddFeedbackRequest {
    user_id?: string;
    conversation_id: string;
    feedback_content: string;
    agent_id?: string;
    app_id?: string;
    feedback_time?: string;
    allow_public?: boolean;
    allow_knowledgebase_ids?: string[];
}
export interface AddFeedbackResponse {
    success: boolean;
    status: string;
    task_id: string;
}
export interface MemOSToolArgs {
    mode?: "add" | "search" | "get" | "delete" | "feedback" | "help";
    content?: string;
    query?: string;
    memoryId?: string;
    memoryIds?: string[];
    limit?: number;
    userId?: string;
    conversationId?: string;
}
export type TagScope = "user" | "project" | "conversation";
export interface MemOSTags {
    conversationId: string;
    user: string;
    project: string;
}
export interface CompactionState {
    lastCompactionTime: Map<string, number>;
    compactionInProgress: Set<string>;
    summarizedSessions: Set<string>;
}
export interface CompactionConfig {
    threshold: number;
    minTokens: number;
    cooldownMs: number;
    getModelLimit?: (providerID: string, modelID: string) => number | undefined;
}
export interface CompactionContext {
    directory: string;
    client: {
        session: {
            summarize: (params: {
                path: {
                    id: string;
                };
                body: {
                    providerID: string;
                    modelID: string;
                };
                query: {
                    directory: string;
                };
            }) => Promise<unknown>;
            messages: (params: {
                path: {
                    id: string;
                };
                query: {
                    directory: string;
                };
            }) => Promise<{
                data?: Array<{
                    info: MessageInfo;
                }>;
            }>;
            promptAsync: (params: {
                path: {
                    id: string;
                };
                body: {
                    agent?: string;
                    parts: Array<{
                        type: string;
                        text: string;
                    }>;
                };
                query: {
                    directory: string;
                };
            }) => Promise<unknown>;
        };
        tui: {
            showToast: (params: {
                body: {
                    title: string;
                    message: string;
                    variant: string;
                    duration: number;
                };
            }) => Promise<unknown>;
        };
    };
}
export interface MessageInfo {
    id: string;
    role: string;
    sessionID: string;
    providerID?: string;
    modelID?: string;
    tokens?: {
        input: number;
        output: number;
        cache: {
            read: number;
            write: number;
        };
    };
    summary?: boolean;
    finish?: boolean;
}
//# sourceMappingURL=index.d.ts.map