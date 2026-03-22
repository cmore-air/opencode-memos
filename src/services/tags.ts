import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { cwd } from "node:process";
import { CONFIG } from "../config.js";
import type { MemOSTags } from "../types/index.js";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function getGitEmail(): string | null {
  try {
    const email = execSync("git config user.email", { encoding: "utf-8" }).trim();
    return email || null;
  } catch {
    return null;
  }
}

export function getUserTag(): string {
  // Priority: explicit config > git email > MEMOS_USER_ID env > anonymous
  if (CONFIG.userContainerTag) {
    return CONFIG.userContainerTag;
  }
  const email = getGitEmail();
  if (email) {
    return `${CONFIG.containerTagPrefix}_user_${sha256(email)}`;
  }
  const fallback = process.env.MEMOS_USER_ID || "anonymous";
  return `${CONFIG.containerTagPrefix}_user_${sha256(fallback)}`;
}

export function getProjectTag(): string {
  // Priority: explicit config > directory hash
  if (CONFIG.projectContainerTag) {
    return CONFIG.projectContainerTag;
  }
  const dir = cwd();
  return `${CONFIG.containerTagPrefix}_project_${sha256(dir)}`;
}

export function getConversationTag(sessionId: string): string {
  return sessionId;
}

export function getTags(sessionId: string): MemOSTags {
  return {
    conversationId: getConversationTag(sessionId),
    user: getUserTag(),
    project: getProjectTag(),
  };
}
