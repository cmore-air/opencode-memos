import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { memOSClient } from "./client.js";
import { log } from "./logger.js";
import { CONFIG } from "../config.js";
import type { CompactionContext, CompactionState, MessageInfo } from "../types/index.js";

const MESSAGE_STORAGE = join(homedir(), ".opencode", "memos_messages");
const PART_STORAGE = join(homedir(), ".opencode", "memos_parts");

const DEFAULT_THRESHOLD = 0.80;
const MIN_TOKENS_FOR_COMPACTION = 50_000;
const COMPACTION_COOLDOWN_MS = 30_000;
const DEFAULT_CONTEXT_LIMIT = 200_000;

interface StoredMessage {
  agent?: string;
  model?: { providerID?: string; modelID?: string };
}

function createCompactionPrompt(projectMemories: string[]): string {
  const memoriesSection = projectMemories.length > 0
    ? `
## Project Knowledge (from MemOS)
The following project-specific knowledge should be preserved and referenced in the summary:
${projectMemories.map(m => `- ${m}`).join('\n')}
`
    : '';

  return `[COMPACTION CONTEXT INJECTION]

When summarizing this session, you MUST include the following sections in your summary:

## 1. User Requests (As-Is)
- List all original user requests exactly as they were stated
- Preserve the user's exact wording and intent

## 2. Final Goal
- What the user ultimately wanted to achieve
- The end result or deliverable expected

## 3. Work Completed
- What has been done so far
- Files created/modified
- Features implemented
- Problems solved

## 4. Remaining Tasks
- What still needs to be done
- Pending items from the original request
- Follow-up tasks identified during the work

## 5. MUST NOT Do (Critical Constraints)
- Things that were explicitly forbidden
- Approaches that failed and should not be retried
- User's explicit restrictions or preferences
- Anti-patterns identified during the session
${memoriesSection}
This context is critical for maintaining continuity after compaction.
`;
}

function getMessageDir(sessionID: string): string | null {
  if (!existsSync(MESSAGE_STORAGE)) return null;

  const directPath = join(MESSAGE_STORAGE, sessionID);
  if (existsSync(directPath)) return directPath;

  for (const dir of readdirSync(MESSAGE_STORAGE)) {
    const sessionPath = join(MESSAGE_STORAGE, dir, sessionID);
    if (existsSync(sessionPath)) return sessionPath;
  }

  return null;
}

function getOrCreateMessageDir(sessionID: string): string {
  if (!existsSync(MESSAGE_STORAGE)) {
    mkdirSync(MESSAGE_STORAGE, { recursive: true });
  }

  const directPath = join(MESSAGE_STORAGE, sessionID);
  if (existsSync(directPath)) return directPath;

  for (const dir of readdirSync(MESSAGE_STORAGE)) {
    const sessionPath = join(MESSAGE_STORAGE, dir, sessionID);
    if (existsSync(sessionPath)) return sessionPath;
  }

  mkdirSync(directPath, { recursive: true });
  return directPath;
}

function findNearestMessageWithFields(messageDir: string): StoredMessage | null {
  try {
    const files = readdirSync(messageDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const content = readFileSync(join(messageDir, file), "utf-8");
        const msg = JSON.parse(content) as StoredMessage;
        if (msg.agent && msg.model?.providerID && msg.model?.modelID) {
          return msg;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function generateMessageId(): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(36).substring(2, 14);
  return `msg_${timestamp}${random}`;
}

function generatePartId(): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(36).substring(2, 10);
  return `prt_${timestamp}${random}`;
}

function injectHookMessage(
  sessionID: string,
  hookContent: string,
  originalMessage: {
    agent?: string;
    model?: { providerID?: string; modelID?: string };
    path?: { cwd?: string; root?: string };
  }
): boolean {
  if (!hookContent || hookContent.trim().length === 0) {
    log("[compaction] attempted to inject empty content, skipping");
    return false;
  }

  const messageDir = getOrCreateMessageDir(sessionID);
  const fallback = findNearestMessageWithFields(messageDir);

  const now = Date.now();
  const messageID = generateMessageId();
  const partID = generatePartId();

  const resolvedAgent = originalMessage.agent ?? fallback?.agent ?? "general";
  const resolvedModel =
    originalMessage.model?.providerID && originalMessage.model?.modelID
      ? { providerID: originalMessage.model.providerID, modelID: originalMessage.model.modelID }
      : fallback?.model?.providerID && fallback?.model?.modelID
        ? { providerID: fallback.model.providerID, modelID: fallback.model.modelID }
        : undefined;

  const messageMeta = {
    id: messageID,
    sessionID,
    role: "user",
    time: { created: now },
    agent: resolvedAgent,
    model: resolvedModel,
    path: originalMessage.path?.cwd
      ? { cwd: originalMessage.path.cwd, root: originalMessage.path.root ?? "/" }
      : undefined,
  };

  const textPart = {
    id: partID,
    type: "text",
    text: hookContent,
    synthetic: true,
    time: { start: now, end: now },
    messageID,
    sessionID,
  };

  try {
    writeFileSync(join(messageDir, `${messageID}.json`), JSON.stringify(messageMeta, null, 2));

    const partDir = join(PART_STORAGE, messageID);
    if (!existsSync(partDir)) {
      mkdirSync(partDir, { recursive: true });
    }
    writeFileSync(join(partDir, `${partID}.json`), JSON.stringify(textPart, null, 2));

    log("[compaction] hook message injected", { sessionID, messageID });
    return true;
  } catch (err) {
    log("[compaction] failed to inject hook message", { error: String(err) });
    return false;
  }
}

export interface CompactionOptions {
  threshold?: number;
  minTokens?: number;
  cooldownMs?: number;
  getModelLimit?: (providerID: string, modelID: string) => number | undefined;
}

export function createCompactionHook(
  ctx: CompactionContext,
  tags: { user: string; project: string },
  options?: CompactionOptions
) {
  const state: CompactionState = {
    lastCompactionTime: new Map(),
    compactionInProgress: new Set(),
    summarizedSessions: new Set(),
  };

  const threshold = options?.threshold ?? CONFIG.compactionThreshold ?? DEFAULT_THRESHOLD;
  const minTokens = options?.minTokens ?? CONFIG.minTokensForCompaction ?? MIN_TOKENS_FOR_COMPACTION;
  const cooldownMs = options?.cooldownMs ?? (CONFIG.compactionCooldownSeconds ?? 30) * 1000;
  const getModelLimit = options?.getModelLimit;

  async function fetchProjectMemoriesForCompaction(): Promise<string[]> {
    try {
      const result = await memOSClient.searchMemory("", tags.project, { limit: CONFIG.maxProjectMemories });
      const memories = result.data?.memory_detail_list || [];
      return memories.map((m) => m.memory_value).filter(Boolean);
    } catch (err) {
      log("[compaction] failed to fetch project memories", { error: String(err) });
      return [];
    }
  }

  async function injectCompactionContext(
    sessionID: string,
    providerID: string,
    modelID: string,
    agent?: string,
    directory?: string
  ): Promise<void> {
    log("[compaction] injecting context", { sessionID });

    const projectMemories = await fetchProjectMemoriesForCompaction();
    const prompt = createCompactionPrompt(projectMemories);

    const success = injectHookMessage(sessionID, prompt, {
      agent,
      model: { providerID, modelID },
      path: directory ? { cwd: directory } : undefined,
    });

    if (success) {
      log("[compaction] context injected with project memories", {
        sessionID,
        memoriesCount: projectMemories.length,
      });
    }
  }

  async function saveSummaryAsMemory(sessionID: string, summaryContent: string): Promise<void> {
    if (!summaryContent || summaryContent.length < 100) {
      log("[compaction] summary too short to save", { sessionID, length: summaryContent.length });
      return;
    }

    try {
      const result = await memOSClient.addMessage({
        conversation_id: tags.project,
        messages: [
          { role: "assistant", content: `[Session Summary]\n${summaryContent}` },
        ],
      });

      if (result.success) {
        log("[compaction] summary saved as memory", { sessionID });
      } else {
        log("[compaction] failed to save summary", { error: result.error });
      }
    } catch (err) {
      log("[compaction] failed to save summary", { error: String(err) });
    }
  }

  async function checkAndTriggerCompaction(sessionID: string, lastAssistant: MessageInfo): Promise<void> {
    if (state.compactionInProgress.has(sessionID)) return;

    const lastCompaction = state.lastCompactionTime.get(sessionID) ?? 0;
    if (Date.now() - lastCompaction < cooldownMs) return;

    if (lastAssistant.summary === true) return;

    const tokens = lastAssistant.tokens;
    if (!tokens) return;

    let modelID = lastAssistant.modelID ?? "";
    let providerID = lastAssistant.providerID ?? "";
    let agent: string | undefined;

    const messageDir = getMessageDir(sessionID);
    const storedMessage = messageDir ? findNearestMessageWithFields(messageDir) : null;

    if (!providerID || !modelID) {
      if (storedMessage?.model?.providerID) providerID = storedMessage.model.providerID;
      if (storedMessage?.model?.modelID) modelID = storedMessage.model.modelID;
    }
    agent = storedMessage?.agent;

    const configLimit = getModelLimit?.(providerID, modelID);
    const contextLimit = configLimit ?? DEFAULT_CONTEXT_LIMIT;
    const totalUsed = tokens.input + tokens.cache.read + tokens.output;

    if (totalUsed < minTokens) return;

    const usageRatio = totalUsed / contextLimit;

    log("[compaction] checking", {
      sessionID,
      totalUsed,
      contextLimit,
      usageRatio: usageRatio.toFixed(2),
      threshold,
    });

    if (usageRatio < threshold) return;

    state.compactionInProgress.add(sessionID);
    state.lastCompactionTime.set(sessionID, Date.now());

    if (!providerID || !modelID) {
      state.compactionInProgress.delete(sessionID);
      return;
    }

    try {
      ctx.client.tui.showToast({
        body: {
          title: "Preemptive Compaction",
          message: `Context at ${(usageRatio * 100).toFixed(0)}% - compacting with MemOS context...`,
          variant: "warning",
          duration: 3000,
        },
      }).catch(() => {});
    } catch {}

    log("[compaction] triggering compaction", { sessionID, usageRatio });

    try {
      await injectCompactionContext(sessionID, providerID, modelID, agent, ctx.directory);

      state.summarizedSessions.add(sessionID);

      await ctx.client.session.summarize({
        path: { id: sessionID },
        body: { providerID, modelID },
        query: { directory: ctx.directory },
      });

      try {
        ctx.client.tui.showToast({
          body: {
            title: "Compaction Complete",
            message: "Session compacted with MemOS context. Resuming...",
            variant: "success",
            duration: 2000,
          },
        }).catch(() => {});
      } catch {}

      state.compactionInProgress.delete(sessionID);

      setTimeout(async () => {
        try {
          const messageDir = getMessageDir(sessionID);
          const storedMessage = messageDir ? findNearestMessageWithFields(messageDir) : null;

          await ctx.client.session.promptAsync({
            path: { id: sessionID },
            body: {
              agent: storedMessage?.agent,
              parts: [{ type: "text", text: "Continue" }],
            },
            query: { directory: ctx.directory },
          });
        } catch {}
      }, 500);
    } catch (err) {
      log("[compaction] compaction failed", { sessionID, error: String(err) });
      state.compactionInProgress.delete(sessionID);
    }
  }

  async function handleSummaryMessage(sessionID: string, _messageInfo: MessageInfo): Promise<void> {
    log("[compaction] handleSummaryMessage called", { sessionID, inSet: state.summarizedSessions.has(sessionID) });

    if (!state.summarizedSessions.has(sessionID)) return;

    state.summarizedSessions.delete(sessionID);
    log("[compaction] capturing summary for memory", { sessionID });

    try {
      const resp = await ctx.client.session.messages({
        path: { id: sessionID },
        query: { directory: ctx.directory },
      });

      const messages = (resp.data ?? resp) as Array<{ info: MessageInfo; parts?: Array<{ type: string; text?: string }> }>;

      const summaryMessage = messages.find((m) =>
        m.info.role === "assistant" &&
        m.info.summary === true
      );

      log("[compaction] looking for summary message", {
        sessionID,
        found: !!summaryMessage,
        hasParts: !!summaryMessage?.parts,
      });

      if (summaryMessage?.parts) {
        const textParts = summaryMessage.parts.filter((p) => p.type === "text" && p.text);
        const summaryContent = textParts.map((p) => p.text).join("\n");

        log("[compaction] summary content", {
          sessionID,
          textPartsCount: textParts.length,
          contentLength: summaryContent.length,
        });

        if (summaryContent) {
          await saveSummaryAsMemory(sessionID, summaryContent);
        }
      }
    } catch (err) {
      log("[compaction] failed to capture summary", { error: String(err) });
    }
  }

  return {
    async event({ event }: { event: { type: string; properties?: unknown } }) {
      const props = event.properties as Record<string, unknown> | undefined;

      if (event.type === "session.deleted") {
        const sessionInfo = props?.info as { id?: string } | undefined;
        if (sessionInfo?.id) {
          state.lastCompactionTime.delete(sessionInfo.id);
          state.compactionInProgress.delete(sessionInfo.id);
          state.summarizedSessions.delete(sessionInfo.id);
        }
        return;
      }

      if (event.type === "message.updated") {
        const info = props?.info as MessageInfo | undefined;
        if (!info) return;

        const sessionID = info.sessionID;
        if (!sessionID) return;

        if (info.role === "assistant" && info.summary === true && info.finish) {
          await handleSummaryMessage(sessionID, info);
          return;
        }

        if (info.role !== "assistant" || !info.finish) return;

        await checkAndTriggerCompaction(sessionID, info);
        return;
      }

      if (event.type === "session.idle") {
        const sessionID = props?.sessionID as string | undefined;
        if (!sessionID) return;

        try {
          const resp = await ctx.client.session.messages({
            path: { id: sessionID },
            query: { directory: ctx.directory },
          });

          const messages = (resp.data ?? resp) as Array<{ info: MessageInfo }>;
          const assistants = messages.filter((m) => m.info.role === "assistant").map((m) => m.info);

          if (assistants.length === 0) return;

          const lastAssistant = assistants[assistants.length - 1]!;

          if (!lastAssistant.providerID || !lastAssistant.modelID) {
            const messageDir = getMessageDir(sessionID);
            const storedMessage = messageDir ? findNearestMessageWithFields(messageDir) : null;
            if (storedMessage?.model?.providerID && storedMessage?.model?.modelID) {
              lastAssistant.providerID = storedMessage.model.providerID;
              lastAssistant.modelID = storedMessage.model.modelID;
            }
          }

          await checkAndTriggerCompaction(sessionID, lastAssistant);
        } catch {}
      }
    },
  };
}
