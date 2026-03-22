import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stripJsoncComments } from "./services/jsonc.js";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_FILES = [
  join(CONFIG_DIR, "memos.jsonc"),
  join(CONFIG_DIR, "memos.json"),
];

interface MemOSConfig {
  apiKey?: string;
  userId?: string;
  channel?: string;
  baseUrl?: string;
  similarityThreshold?: number;
  maxMemories?: number;
  maxProfileItems?: number;
  injectProfile?: boolean;
  keywordPatterns?: string[];
}

const DEFAULT_KEYWORD_PATTERNS = [
  "remember",
  "memorize",
  "save\\s+this",
  "note\\s+this",
  "keep\\s+in\\s+mind",
  "don'?t\\s+forget",
  "learn\\s+this",
  "store\\s+this",
  "record\\s+this",
  "make\\s+a\\s+note",
  "take\\s+note",
  "jot\\s+down",
  "commit\\s+to\\s+memory",
  "remember\\s+that",
  "never\\s+forget",
  "always\\s+remember",
];

const DEFAULTS: Required<Omit<MemOSConfig, "apiKey" | "userId" | "channel">> = {
  baseUrl: "https://memos.memtensor.cn/api/openmem/v1",
  similarityThreshold: 0.45,
  maxMemories: 9,
  maxProfileItems: 5,
  injectProfile: true,
  keywordPatterns: [],
};

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function loadConfig(): MemOSConfig {
  for (const path of CONFIG_FILES) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        const json = stripJsoncComments(content);
        return JSON.parse(json) as MemOSConfig;
      } catch {}
    }
  }
  return {};
}

const fileConfig = loadConfig();

function getApiKey(): string | undefined {
  // Priority: env var > config file
  if (process.env.MEMOS_API_KEY) return process.env.MEMOS_API_KEY;
  if (fileConfig.apiKey) return fileConfig.apiKey;
  return undefined;
}

function getUserId(): string | undefined {
  if (process.env.MEMOS_USER_ID) return process.env.MEMOS_USER_ID;
  if (fileConfig.userId) return fileConfig.userId;
  return undefined;
}

function getChannel(): string | undefined {
  if (process.env.MEMOS_CHANNEL) return process.env.MEMOS_CHANNEL;
  if (fileConfig.channel) return fileConfig.channel;
  return undefined;
}

export const MEMOS_API_KEY = getApiKey();
export const MEMOS_USER_ID = getUserId();
export const MEMOS_CHANNEL = getChannel();

export const CONFIG = {
  baseUrl: fileConfig.baseUrl ?? DEFAULTS.baseUrl,
  similarityThreshold: fileConfig.similarityThreshold ?? DEFAULTS.similarityThreshold,
  maxMemories: fileConfig.maxMemories ?? DEFAULTS.maxMemories,
  maxProfileItems: fileConfig.maxProfileItems ?? DEFAULTS.maxProfileItems,
  injectProfile: fileConfig.injectProfile ?? DEFAULTS.injectProfile,
  keywordPatterns: [
    ...DEFAULT_KEYWORD_PATTERNS,
    ...(fileConfig.keywordPatterns ?? []).filter(isValidRegex),
  ],
};

export function isConfigured(): boolean {
  return !!(MEMOS_API_KEY && MEMOS_USER_ID && MEMOS_CHANNEL);
}
