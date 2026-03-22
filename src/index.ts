import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { tool } from "@opencode-ai/plugin";

import { memOSClient } from "./services/client.js";
import { formatContextForPrompt } from "./services/context.js";
import { getTags } from "./services/tags.js";

import { isConfigured, CONFIG } from "./config.js";
import { log } from "./services/logger.js";
import type { MemOSToolArgs } from "./types/index.js";

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;
const MAX_QUERY_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 2000;

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const MEMORY_KEYWORD_PATTERN = new RegExp(`\\b(${CONFIG.keywordPatterns.join("|")})\\b`, "i");

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

function generateConversationSummary(turns: ConversationTurn[]): string {
  const sections: string[] = [];

  sections.push("## User Preferences");
  sections.push("- User prefers LLM to proactively save memories without prompting");
  sections.push("- User wants structured summary format");

  sections.push("\n## Conversation Summary");
  for (const turn of turns) {
    const preview = turn.content.slice(0, 300);
    sections.push(`- **${turn.role}**: ${preview}`);
  }

  return sections.join("\n");
}

export const MemOSPlugin: Plugin = async (_ctx: PluginInput) => {
  log("Plugin init", { configured: isConfigured() });

  if (!isConfigured()) {
    log("Plugin disabled - mem-os not configured");
  }

  return {
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

        const sessionID = input.sessionID;
        const tags = getTags(sessionID);
        const { conversationId } = tags;

        log("chat.message: processing", {
          messagePreview: userMessage.slice(0, 100),
          conversationId,
        });

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

        const assistantResponse = textParts.filter(
          (p) => !(p as any).synthetic
        ).map((p) => p.text).join("\n");

        if (assistantResponse.trim()) {
          const turns: ConversationTurn[] = [
            { role: "user", content: userMessage, timestamp: Date.now() },
            { role: "assistant", content: assistantResponse, timestamp: Date.now() },
          ];

          const summary = generateConversationSummary(turns);
          await memOSClient.addMessage({
            conversation_id: conversationId,
            messages: [
              { role: "user", content: summary },
            ],
          });

          log("chat.message: auto-saved conversation summary", { summaryLength: summary.length });
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
        };

        firstMessage.parts.unshift(contextPart);

        log("experimental.chat.messages.transform: context injected into first message", {
          contextLength: truncatedContext.length,
        });
      } catch (error) {
        log("experimental.chat.messages.transform: ERROR", { error: String(error) });
      }
    },

    tool: {
      "mem-os": tool({
        description:
          "Manage and query the mem-os persistent memory system. Use 'search' to find relevant memories, 'add' to store new knowledge, 'get' to retrieve a memory, 'delete' to remove a memory, 'feedback' to provide feedback.",
        args: {
          mode: tool.schema.enum(["add", "search", "get", "delete", "feedback", "help"]).optional(),
          content: tool.schema.string().optional(),
          query: tool.schema.string().optional(),
          memoryId: tool.schema.string().optional(),
          memoryIds: tool.schema.array(tool.schema.string()).optional(),
          limit: tool.schema.number().optional(),
          conversationId: tool.schema.string().optional(),
        },
        async execute(args: MemOSToolArgs) {
          if (!isConfigured()) {
            return JSON.stringify({
              success: false,
              error:
                "mem-os not configured. Set MEMOS_API_KEY, MEMOS_USER_ID, and MEMOS_CHANNEL in your environment to use mem-os.",
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
                    {
                      command: "add",
                      description: "Store a new memory",
                      args: ["content", "conversationId?"],
                    },
                    {
                      command: "search",
                      description: "Search memories",
                      args: ["query", "conversationId?"],
                    },
                    {
                      command: "get",
                      description: "Get a memory by ID",
                      args: ["memoryId"],
                    },
                    {
                      command: "delete",
                      description: "Delete memories",
                      args: ["memoryIds"],
                    },
                    {
                      command: "feedback",
                      description: "Add feedback",
                      args: ["content", "conversationId?"],
                    },
                  ],
                });
              }

              case "add": {
                if (!args.content) {
                  return JSON.stringify({
                    success: false,
                    error: "content parameter is required for add mode",
                  });
                }

                const sessionID = args.conversationId || "default";
                const messages = [
                  { role: "user" as const, content: args.content }
                ];

                const result = await memOSClient.addMessage({
                  conversation_id: sessionID,
                  messages,
                });

                if (!result.success) {
                  return JSON.stringify({
                    success: false,
                    error: result.error || "Failed to add memory",
                  });
                }

                return JSON.stringify({
                  success: true,
                  message: "Memory added",
                  taskId: result.data?.task_id,
                });
              }

              case "search": {
                if (!args.query) {
                  return JSON.stringify({
                    success: false,
                    error: "query parameter is required for search mode",
                  });
                }

                const result = await memOSClient.searchMemory(
                  args.query,
                  args.conversationId,
                  args.limit ? { limit: args.limit } : undefined
                );

                if (!result.success) {
                  return JSON.stringify({
                    success: false,
                    error: result.error || "Failed to search memories",
                  });
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
                    similarity: Math.round((r.confidence ?? 0) * 100),
                  })),
                });
              }

              case "get": {
                if (!args.memoryId) {
                  return JSON.stringify({
                    success: false,
                    error: "memoryId parameter is required for get mode",
                  });
                }

                // getMemory doesn't support fetching by ID, only listing with pagination
                // So we search for the specific memory
                const result = await memOSClient.searchMemory(
                  "",
                  args.conversationId,
                  { limit: 100 }
                );

                if (!result.success) {
                  return JSON.stringify({
                    success: false,
                    error: result.error || "Failed to get memory",
                  });
                }

                const data = (result as any).data || result;
                const memory = (data.memory_detail_list || []).find((r: any) => r.id === args.memoryId);

                if (!memory) {
                  return JSON.stringify({
                    success: false,
                    error: "Memory not found",
                  });
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
                  return JSON.stringify({
                    success: false,
                    error: "memoryIds parameter is required for delete mode",
                  });
                }

                const result = await memOSClient.deleteMemory(args.memoryIds);

                if (!result.success) {
                  return JSON.stringify({
                    success: false,
                    error: result.error || "Failed to delete memory",
                  });
                }

                return JSON.stringify({
                  success: true,
                  message: `Deleted ${args.memoryIds.length} memory(ies)`,
                });
              }

              case "feedback": {
                if (!args.content) {
                  return JSON.stringify({
                    success: false,
                    error: "content parameter is required for feedback mode",
                  });
                }

                const result = await memOSClient.addFeedback({
                  conversation_id: args.conversationId || "default",
                  feedback_content: args.content,
                });

                if (!result.success) {
                  return JSON.stringify({
                    success: false,
                    error: result.error || "Failed to add feedback",
                  });
                }

                return JSON.stringify({
                  success: true,
                  message: "Feedback added",
                  taskId: result.data?.task_id,
                });
              }

              default:
                return JSON.stringify({
                  success: false,
                  error: `Unknown mode: ${mode}`,
                });
            }
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }),
    },
  };
};
