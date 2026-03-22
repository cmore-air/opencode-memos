// Message roles
export type MessageRole = "user" | "assistant" | "system" | "tool";

// Message content types
export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: { url: string } }
  | { type: "file"; file: { file_data: string } };

// Message structure for add/message API
export interface MemOSMessage {
  role: MessageRole;
  content: string | MessageContentPart[];
  chat_time?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

// Add message request
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

// Memory types
export type MemoryType = "WorkingMemory" | "LongTermMemory" | "UserMemory";
export type PreferenceType = "explicit_preference" | "implicit_preference";
export type ToolMemoryType = "ToolTrajectoryMemory" | "ToolSchema";

// Memory detail from search/get responses
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

// Preference detail
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

// Tool memory detail
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

// Search memory response
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

// Get memory response
export interface GetMemoryResponse {
  memory_detail_list: MemoryDetail[];
  preference_detail_list: PreferenceDetail[];
  tool_memory_detail_list: ToolMemoryDetail[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

// API response wrapper
export interface MemOSApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// Add message response
export interface AddMessageResponse {
  success: boolean;
  task_id: string;
  status: "running" | "completed" | "failed";
}

// Delete memory response
export interface DeleteMemoryResponse {
  success: boolean;
}

// Add feedback request
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

// Add feedback response
export interface AddFeedbackResponse {
  success: boolean;
  status: string;
  task_id: string;
}

// Tool args for mem-os tool
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
