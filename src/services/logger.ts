import { appendFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const LOG_DIR = join(homedir(), ".config", "opencode");
const LOG_FILE = join(LOG_DIR, ".opencode-memos.log");

export let DEBUG = false;

export function setDebug(enabled: boolean) {
  DEBUG = enabled;
}

try {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
  writeFileSync(LOG_FILE, `\n--- Session started: ${new Date().toISOString()} ---\n`, { flag: "a" });
} catch {}

export function log(message: string, data?: unknown) {
  try {
    const timestamp = new Date().toISOString();
    const line = data 
      ? `[${timestamp}] ${message}: ${JSON.stringify(data)}\n`
      : `[${timestamp}] ${message}\n`;
    appendFileSync(LOG_FILE, line);
  } catch {}
}

export function debug(message: string, data?: unknown) {
  if (DEBUG) {
    try {
      const timestamp = new Date().toISOString();
      const line = data 
        ? `[${timestamp}] [DEBUG] ${message}: ${JSON.stringify(data)}\n`
        : `[${timestamp}] [DEBUG] ${message}\n`;
      appendFileSync(LOG_FILE, line);
      // Only write to file, not to stderr to avoid polluting OpenCode UI
    } catch {}
  }
}
