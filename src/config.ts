import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stripJsoncComments } from "./services/jsonc.js";
import { setDebug, debug } from "./services/logger.js";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_FILES = [
  join(CONFIG_DIR, "mem-os.jsonc"),
  join(CONFIG_DIR, "mem-os.json"),
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
  debug?: boolean;
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
  debug: false,
};

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function loadConfig(): { config: Partial<MemOSConfig>; source?: string } {
  for (const path of CONFIG_FILES) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        const json = stripJsoncComments(content);
        debug(`Global config loaded from: ${path}`, JSON.parse(json));
        return { config: JSON.parse(json) as MemOSConfig, source: path };
      } catch (e) {
        debug(`Failed to parse global config: ${path}`, { error: String(e) });
      }
    }
  }
  return { config: {} };
}

function findProjectConfig(): { config: Partial<MemOSConfig>; source?: string } {
  const cwd = process.cwd();
  for (const filename of PROJECT_CONFIG_FILES) {
    const path = join(cwd, filename);
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        const json = stripJsoncComments(content);
        debug(`Project config loaded from: ${path}`, JSON.parse(json));
        return { config: JSON.parse(json) as MemOSConfig, source: path };
      } catch (e) {
        debug(`Failed to parse project config: ${path}`, { error: String(e) });
      }
    }
  }
  return { config: {} };
}

const { config: fileConfig, source: fileConfigSource } = loadConfig();
const { config: projectConfig, source: projectConfigSource } = findProjectConfig();

function getApiKey(): string | undefined {
  if (projectConfig.apiKey) {
    debug("API key source: project config", { source: projectConfigSource });
    return projectConfig.apiKey;
  }
  if (fileConfig.apiKey) {
    debug("API key source: global config", { source: fileConfigSource });
    return fileConfig.apiKey;
  }
  if (process.env.MEMOS_API_KEY) {
    debug("API key source: environment variable");
    return process.env.MEMOS_API_KEY;
  }
  debug("API key: not found in any source");
  return undefined;
}

function getUserId(): string | undefined {
  if (projectConfig.userId) {
    debug("User ID source: project config", { source: projectConfigSource });
    return projectConfig.userId;
  }
  if (fileConfig.userId) {
    debug("User ID source: global config", { source: fileConfigSource });
    return fileConfig.userId;
  }
  if (process.env.MEMOS_USER_ID) {
    debug("User ID source: environment variable");
    return process.env.MEMOS_USER_ID;
  }
  debug("User ID: not found in any source");
  return undefined;
}

function getChannel(): string | undefined {
  if (projectConfig.channel) {
    debug("Channel source: project config", { source: projectConfigSource });
    return projectConfig.channel;
  }
  if (fileConfig.channel) {
    debug("Channel source: global config", { source: fileConfigSource });
    return fileConfig.channel;
  }
  if (process.env.MEMOS_CHANNEL) {
    debug("Channel source: environment variable");
    return process.env.MEMOS_CHANNEL;
  }
  debug("Channel: not found in any source");
  return undefined;
}

export const MEMOS_API_KEY = getApiKey();
export const MEMOS_USER_ID = getUserId();
export const MEMOS_CHANNEL = getChannel();

// Enable debug mode if configured
const debugEnabled = projectConfig.debug ?? fileConfig.debug ?? false;
setDebug(debugEnabled);

if (debugEnabled) {
  debug("Debug mode enabled");
  debug("Config priority: project config > global config > environment variables");
  debug("Project config source", { source: projectConfigSource || "none" });
  debug("Global config source", { source: fileConfigSource || "none" });
}

export const CONFIG = {
  baseUrl: projectConfig.baseUrl ?? fileConfig.baseUrl ?? DEFAULTS.baseUrl,
  similarityThreshold: projectConfig.similarityThreshold ?? fileConfig.similarityThreshold ?? DEFAULTS.similarityThreshold,
  maxMemories: projectConfig.maxMemories ?? fileConfig.maxMemories ?? DEFAULTS.maxMemories,
  maxProfileItems: projectConfig.maxProfileItems ?? fileConfig.maxProfileItems ?? DEFAULTS.maxProfileItems,
  injectProfile: projectConfig.injectProfile ?? fileConfig.injectProfile ?? DEFAULTS.injectProfile,
  keywordPatterns: [
    ...DEFAULT_KEYWORD_PATTERNS,
    ...(projectConfig.keywordPatterns ?? fileConfig.keywordPatterns ?? []).filter(isValidRegex),
  ],
  compactionThreshold: projectConfig.compactionThreshold ?? fileConfig.compactionThreshold ?? DEFAULTS.compactionThreshold,
  minTokensForCompaction: projectConfig.minTokensForCompaction ?? fileConfig.minTokensForCompaction ?? DEFAULTS.minTokensForCompaction,
  compactionCooldownSeconds: projectConfig.compactionCooldownSeconds ?? fileConfig.compactionCooldownSeconds ?? DEFAULTS.compactionCooldownSeconds,
  containerTagPrefix: projectConfig.containerTagPrefix ?? fileConfig.containerTagPrefix ?? DEFAULTS.containerTagPrefix,
  userContainerTag: projectConfig.userContainerTag ?? fileConfig.userContainerTag,
  projectContainerTag: projectConfig.projectContainerTag ?? fileConfig.projectContainerTag,
  maxProjectMemories: projectConfig.maxProjectMemories ?? fileConfig.maxProjectMemories ?? DEFAULTS.maxProjectMemories,
};

if (debugEnabled) {
  debug("Final CONFIG applied", CONFIG);
}

export function isConfigured(): boolean {
  return !!(MEMOS_API_KEY && MEMOS_USER_ID && MEMOS_CHANNEL);
}
