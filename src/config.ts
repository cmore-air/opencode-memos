import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stripJsoncComments } from "./services/jsonc.js";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_FILES = [
  join(CONFIG_DIR, "memos.jsonc"),
  join(CONFIG_DIR, "memos.json"),
];
const PROJECT_CONFIG_FILES = [
  "mem-os.jsonc",
  "mem-os.json",
  ".mem-os.jsonc",
  ".mem-os.json",
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
  compactionThreshold?: number;
  minTokensForCompaction?: number;
  compactionCooldownSeconds?: number;
  containerTagPrefix?: string;
  userContainerTag: string | undefined;
  projectContainerTag: string | undefined;
  maxProjectMemories?: number;
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
  compactionThreshold: 0.80,
  minTokensForCompaction: 50000,
  compactionCooldownSeconds: 30,
  containerTagPrefix: "opencode",
  userContainerTag: undefined,
  projectContainerTag: undefined,
  maxProjectMemories: 10,
};

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function loadConfig(): Partial<MemOSConfig> {
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

function findProjectConfig(): Partial<MemOSConfig> {
  const cwd = process.cwd();
  for (const filename of PROJECT_CONFIG_FILES) {
    const path = join(cwd, filename);
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
const projectConfig = findProjectConfig();

function getApiKey(): string | undefined {
  if (projectConfig.apiKey) return projectConfig.apiKey;
  if (process.env.MEMOS_API_KEY) return process.env.MEMOS_API_KEY;
  if (fileConfig.apiKey) return fileConfig.apiKey;
  return undefined;
}

function getUserId(): string | undefined {
  if (projectConfig.userId) return projectConfig.userId;
  if (process.env.MEMOS_USER_ID) return process.env.MEMOS_USER_ID;
  if (fileConfig.userId) return fileConfig.userId;
  return undefined;
}

function getChannel(): string | undefined {
  if (projectConfig.channel) return projectConfig.channel;
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
  compactionThreshold: fileConfig.compactionThreshold ?? DEFAULTS.compactionThreshold,
  minTokensForCompaction: fileConfig.minTokensForCompaction ?? DEFAULTS.minTokensForCompaction,
  compactionCooldownSeconds: fileConfig.compactionCooldownSeconds ?? DEFAULTS.compactionCooldownSeconds,
  containerTagPrefix: fileConfig.containerTagPrefix ?? DEFAULTS.containerTagPrefix,
  userContainerTag: fileConfig.userContainerTag,
  projectContainerTag: fileConfig.projectContainerTag,
  maxProjectMemories: fileConfig.maxProjectMemories ?? DEFAULTS.maxProjectMemories,
};

export function isConfigured(): boolean {
  return !!(MEMOS_API_KEY && MEMOS_USER_ID && MEMOS_CHANNEL);
}
