import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { tool } from "@opencode-ai/plugin";

import { memOSClient } from "./services/client.js";
import { formatContextForPrompt } from "./services/context.js";
import { getTags } from "./services/tags.js";
import { createCompactionHook } from "./services/compaction.js";

import { isConfigured, CONFIG } from "./config.js";
import { log } from "./services/logger.js";
import type { CompactionContext, MemOSToolArgs } from "./types/index.js";

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;
const MAX_QUERY_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 2000;

let MEMORY_KEYWORD_PATTERN: RegExp;
try {
  const patterns = CONFIG.keywordPatterns || [];
  MEMORY_KEYWORD_PATTERN = new RegExp(`\\b(${patterns.join("|")})\\b`, "i");
} catch (e) {
  log("Failed to initialize MEMORY_KEYWORD_PATTERN, using default", { error: String(e) });
  MEMORY_KEYWORD_PATTERN = new RegExp(`\\b(remember|memorize|save\\s+this)\\b`, "i");
}

const MEMORY_NUDGE_MESSAGE = `[MEMORY TRIGGER DETECTED]
The user wants you to remember something. You MUST use the \`mem-os\` tool with \`mode: "add"\` to save this information.

Extract the key information the user wants remembered and save it as a concise, searchable memory.

DO NOT skip this step. The user explicitly asked you to remember.`;

function removeCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_PATTERN, "").replace(INLINE_CODE_PATTERN, "");
}

function detectMemoryKeyword(text: string): boolean {
  const textWithoutCode = removeCodeBlocks(text);
  return MEMORY_KEYWORD_PATTERN.test(textWithoutCode);
}

export const MemOSPlugin: Plugin = async (ctx: PluginInput) => {
  try {
    const directory = ctx.directory;
    const tags = getTags(directory);
    const injectedSessions = new Set<string>();
    log("Plugin init", { directory, tags, configured: isConfigured() });

    if (!isConfigured()) {
      return {
        event: async () => {},
      };
    }

    const modelLimits = new Map<string, number>();

    (async () => {
      try {
        if (ctx.client?.provider?.list) {
          const response = await ctx.client.provider.list();
          if (response.data?.all) {
            for (const provider of response.data.all) {
              if (provider.models) {
                for (const [modelId, model] of Object.entries(provider.models)) {
                  if (model.limit?.context) {
                    modelLimits.set(`${provider.id}/${modelId}`, model.limit.context);
                  }
                }
              }
            }
          }
          log("Model limits loaded", { count: modelLimits.size });
        }
      } catch (error) {
        log("Failed to fetch model limits", { error: String(error) });
      }
    })();

    const getModelLimit = (providerID: string, modelID: string): number | undefined => {
      return modelLimits.get(`${providerID}/${modelID}`);
    };

    const compactionHook = ctx.client
      ? createCompactionHook(ctx as CompactionContext, tags, {
          threshold: CONFIG.compactionThreshold,
          getModelLimit,
        })
      : null;

    return {
      event: async (input: { event: { type: string; properties?: unknown } }) => {
        if (compactionHook) {
          await compactionHook.event(input);
        }
      },

      "experimental.session.compacting": async (input, output) => {
        if (!isConfigured() || !compactionHook) return;
        log("experimental.session.compacting: triggered", { sessionID: input.sessionID });
      },

      "chat.message": async (input, output) => {
        if (!isConfigured()) return;

        const start = Date.now();

        try {
          const textParts = output.parts.filter(
            (p): p is Part & { type: "text"; text: string } => p.type === "text"
          );

          if (textParts.length === 0) {
            log("chat.message: no text parts found");
            return;
          }

          const userMessage = textParts.map((p) => p.text).join("\n");

          if (!userMessage.trim()) {
            log("chat.message: empty message, skipping");
            return;
          }

          log("chat.message: processing", {
            messagePreview: userMessage.slice(0, 100),
          });

          const isFirstMessage = !injectedSessions.has(input.sessionID);

          if (isFirstMessage) {
            injectedSessions.add(input.sessionID);

            const sessionID = input.sessionID;
            const { conversationId } = getTags(sessionID);

            const queryForSearch = userMessage.slice(0, MAX_QUERY_LENGTH);
            const searchResult = await memOSClient.searchMemory(queryForSearch, conversationId);

            const memoryContext = formatContextForPrompt(searchResult.success && searchResult.data ? searchResult.data : null);

            if (memoryContext) {
              const truncatedContext = memoryContext.slice(0, MAX_CONTEXT_LENGTH);
              const contextPart: Part = {
                id: `prt-memos-context-${Date.now()}`,
                sessionID: input.sessionID,
                messageID: output.message.id,
                type: "text",
                text: truncatedContext,
                synthetic: true,
              };

              output.parts.unshift(contextPart);

              const duration = Date.now() - start;
              log("chat.message: context injected", {
                duration,
                contextLength: truncatedContext.length,
              });
            }
          }

          if (detectMemoryKeyword(userMessage)) {
            log("chat.message: memory keyword detected");
            const nudgePart: Part = {
              id: `prt-memos-nudge-${Date.now()}`,
              sessionID: input.sessionID,
              messageID: output.message.id,
              type: "text",
              text: MEMORY_NUDGE_MESSAGE,
              synthetic: true,
            };
            output.parts.push(nudgePart);
          }

        } catch (error) {
          log("chat.message: ERROR", { error: String(error) });
        }
      },

      "experimental.chat.messages.transform": async (_input, output) => {
        if (!isConfigured()) return;

        try {
          const messages = output.messages;
          if (messages.length === 0) {
            log("experimental.chat.messages.transform: no messages");
            return;
          }

          const lastUserMessageIdx = [...messages].reverse().findIndex(
            (m) => m.info?.role === "user"
          );
          if (lastUserMessageIdx === -1) {
            log("experimental.chat.messages.transform: no user message found");
            return;
          }
          const userMsgIdx = messages.length - 1 - lastUserMessageIdx;
          const userMessage = messages[userMsgIdx]!;
          const firstMessage = messages[0]!;

          const textParts = userMessage.parts.filter(
            (p): p is Part & { type: "text"; text: string } => p.type === "text"
          );
          if (textParts.length === 0) {
            log("experimental.chat.messages.transform: no text parts in user message");
            return;
          }

          const userText = textParts.map((p) => p.text).join("\n");
          const queryForSearch = userText.slice(0, MAX_QUERY_LENGTH);

          const sessionID = firstMessage.info?.sessionID;
          const tags = getTags(sessionID || "");
          const { conversationId } = tags;

          log("experimental.chat.messages.transform: searching memories", {
            queryPreview: queryForSearch.slice(0, 100),
            conversationId,
          });

          const searchResult = await memOSClient.searchMemory(queryForSearch, conversationId);
          const memoryContext = formatContextForPrompt(
            searchResult.success && searchResult.data ? searchResult.data : null
          );

          if (!memoryContext) {
            log("experimental.chat.messages.transform: no memory context found");
            return;
          }

          const truncatedContext = memoryContext.slice(0, MAX_CONTEXT_LENGTH);
          const contextPart: Part = {
            id: `prt-memos-context-${Date.now()}`,
            sessionID: firstMessage.info?.sessionID,
            messageID: firstMessage.info?.id,
            type: "text",
            text: truncatedContext,
            synthetic: true,
          }

          firstMessage.parts.unshift(contextPart)

          log("experimental.chat.messages.transform: context injected into first message", {
            contextLength: truncatedContext.length,
          })
        } catch (error) {
          log("experimental.chat.messages.transform: ERROR", { error: String(error) })
        }
      },

      tool: {
        "mem-os": tool({
          description: `Manage and query the mem-os persistent memory system.

Modes:
- add: Store new knowledge (supports multimodal: text, images, files)
- search: Find relevant memories (with type/confidence filtering)
- get: Retrieve a specific memory by ID
- delete: Remove memories by IDs
- feedback: Provide feedback to correct/improve memories
- status: Query async task status by taskId
- chat: Have a conversation with memory context
- suggest: Get suggested follow-up questions
- help: Show usage guide`,
          args: {
            mode: tool.schema.enum([
              "add", "search", "get", "delete", "feedback", "status", "chat", "suggest", "help"
            ]).optional(),
            content: tool.schema.string().optional(),
            query: tool.schema.string().optional(),
            memoryId: tool.schema.string().optional(),
            memoryIds: tool.schema.array(tool.schema.string()).optional(),
            retrievedMemoryIds: tool.schema.array(tool.schema.string()).optional(),
            limit: tool.schema.number().optional(),
            conversationId: tool.schema.string().optional(),
            taskId: tool.schema.string().optional(),
            memoryTypes: tool.schema.array(tool.schema.string()).optional(),
            preferenceTypes: tool.schema.array(tool.schema.string()).optional(),
            minConfidence: tool.schema.number().optional(),
            readableCubeIds: tool.schema.array(tool.schema.string()).optional(),
            writableCubeIds: tool.schema.array(tool.schema.string()).optional(),
            addMode: tool.schema.enum(["fast", "fine"]).optional(),
            history: tool.schema.array(tool.schema.object({
              role: tool.schema.enum(["user", "assistant", "system"]),
              content: tool.schema.string(),
            })).optional(),
            correctedAnswer: tool.schema.string().optional(),
          },
          async execute(args: MemOSToolArgs) {
            if (!isConfigured()) {
              return JSON.stringify({
                success: false,
                error: "mem-os not configured. Set MEMOS_API_KEY, MEMOS_USER_ID, and MEMOS_CHANNEL in your environment to use mem-os.",
              });
            }

            const mode = args.mode || "help";

            try {
              switch (mode) {
                case "help": {
                  return JSON.stringify({
                    success: true,
                    message: "mem-os Usage Guide",
                    commands: [
                      { command: "add", description: "Store a new memory", args: ["content", "conversationId?", "addMode?"] },
                      { command: "search", description: "Search memories with filters", args: ["query", "conversationId?", "memoryTypes?", "minConfidence?"] },
                      { command: "get", description: "Get a memory by ID", args: ["memoryId"] },
                      { command: "delete", description: "Delete memories", args: ["memoryIds"] },
                      { command: "feedback", description: "Correct memories with feedback", args: ["content", "conversationId?", "retrievedMemoryIds?"] },
                      { command: "status", description: "Query async task status", args: ["taskId"] },
                      { command: "chat", description: "Chat with memory context", args: ["query", "history?"] },
                      { command: "suggest", description: "Get suggested questions", args: ["conversationId?", "history?"] },
                    ],
                  });
                }

                case "add": {
                  if (!args.content) {
                    return JSON.stringify({ success: false, error: "content required" });
                  }
                  const sessionID = args.conversationId || "default";
                  let content: string | import("./types/index.js").MessageContentPart[];
                  try {
                    const parsed = JSON.parse(args.content);
                    if (Array.isArray(parsed) && parsed[0]?.type) {
                      content = parsed;
                    } else {
                      content = args.content;
                    }
                  } catch {
                    content = args.content;
                  }
                  const messages = [{ role: "user" as const, content }];
                  const result = await memOSClient.addMessage({
                    conversation_id: sessionID,
                    messages,
                    add_mode: args.addMode || CONFIG.defaultAddMode,
                  });
                  if (!result.success) {
                    return JSON.stringify({ success: false, error: result.error || "Failed to add memory" });
                  }
                  return JSON.stringify({ success: true, message: "Memory added", taskId: result.data?.task_id, mode: args.addMode || CONFIG.defaultAddMode });
                }

                case "search": {
                  if (!args.query) {
                    return JSON.stringify({ success: false, error: "query required" });
                  }
                  const filterOptions = {
                    limit: args.limit,
                    memory_types: args.memoryTypes,
                    preference_types: args.preferenceTypes,
                    min_confidence: args.minConfidence,
                  };
                  const result = await memOSClient.searchMemory(args.query, args.conversationId, filterOptions);
                  if (!result.success) {
                    return JSON.stringify({ success: false, error: result.error || "Failed to search" });
                  }
                  const data = (result as any).data || result;
                  const memories = data.memory_detail_list || [];
                  return JSON.stringify({
                    success: true,
                    query: args.query,
                    count: memories.length,
                    results: memories.map((r: any) => ({
                      id: r.id,
                      content: r.memory_value,
                      type: r.memory_type,
                      confidence: Math.round((r.confidence ?? 1) * 100),
                    })),
                  });
                }

                case "get": {
                  if (!args.memoryId) {
                    return JSON.stringify({ success: false, error: "memoryId required" });
                  }
                  const result = await memOSClient.searchMemory("", args.conversationId, { limit: 100 });
                  if (!result.success) {
                    return JSON.stringify({ success: false, error: result.error || "Failed to get memory" });
                  }
                  const data = (result as any).data || result;
                  const memory = (data.memory_detail_list || []).find((r: any) => r.id === args.memoryId);
                  if (!memory) {
                    return JSON.stringify({ success: false, error: "Memory not found" });
                  }
                  return JSON.stringify({
                    success: true,
                    memory: {
                      id: memory.id,
                      content: memory.memory_value,
                      type: memory.memory_type,
                      createdAt: memory.create_time,
                      confidence: memory.confidence,
                    },
                  });
                }

                case "delete": {
                  if (!args.memoryIds || args.memoryIds.length === 0) {
                    return JSON.stringify({ success: false, error: "memoryIds required" });
                  }
                  const result = await memOSClient.deleteMemory(args.memoryIds);
                  if (!result.success) {
                    return JSON.stringify({ success: false, error: result.error || "Failed to delete" });
                  }
                  return JSON.stringify({ success: true, message: `Deleted ${args.memoryIds.length} memory(ies)` });
                }

                case "feedback": {
                  if (!args.content) {
                    return JSON.stringify({ success: false, error: "content required" });
                  }
                  const result = await memOSClient.addFeedbackEnhanced({
                    conversation_id: args.conversationId || "default",
                    feedback_content: args.content,
                    retrieved_memory_ids: args.retrievedMemoryIds,
                    corrected_answer: args.correctedAnswer,
                  });
                  if (!result.success) {
                    return JSON.stringify({ success: false, error: result.error || "Failed to add feedback" });
                  }
                  return JSON.stringify({
                    success: true,
                    message: "Feedback processed",
                    taskId: result.data?.task_id,
                    record: result.data?.record,
                    answer: result.data?.answer,
                  });
                }

                case "status": {
                  if (!args.taskId) {
                    return JSON.stringify({ success: false, error: "taskId required" });
                  }
                  const result = await memOSClient.getTaskStatus(args.taskId);
                  if (!result.success) {
                    return JSON.stringify({ success: false, error: result.error || "Failed to get status" });
                  }
                  return JSON.stringify({
                    success: true,
                    taskId: result.data?.task_id,
                    status: result.data?.status,
                    result: result.data?.result,
                    error: result.data?.error,
                  });
                }

                case "chat": {
                  if (!args.query) {
                    return JSON.stringify({ success: false, error: "query required" });
                  }
                  const result = await memOSClient.chat({
                    query: args.query,
                    history: args.history,
                    readable_cube_ids: args.readableCubeIds,
                    writable_cube_ids: args.writableCubeIds,
                  });
                  if (!result.success) {
                    return JSON.stringify({ success: false, error: result.error || "Failed to chat" });
                  }
                  return JSON.stringify({
                    success: true,
                    response: result.data?.response,
                    memoriesUsed: result.data?.memories_used?.map((m: any) => ({ id: m.id, content: m.memory_value })),
                    taskId: result.data?.task_id,
                  });
                }

                case "suggest": {
                  const result = await memOSClient.getSuggestions({
                    conversation_id: args.conversationId,
                    history: args.history,
                    count: args.limit ?? 3,
                  });
                  if (!result.success) {
                    return JSON.stringify({ success: false, error: result.error || "Failed to get suggestions" });
                  }
                  return JSON.stringify({
                    success: true,
                    suggestions: result.data?.suggestions,
                    mode: result.data?.mode,
                  });
                }

                default:
                  return JSON.stringify({ success: false, error: `Unknown mode: ${mode}` });
              }
            } catch (error) {
              return JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
          },
        }),
      },
    };
  } catch (error) {
    log("Plugin initialization error", { error: error instanceof Error ? error.message : String(error) });
    return {
      event: async () => {},
    };
  }
};
