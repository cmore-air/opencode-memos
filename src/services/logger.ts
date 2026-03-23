import { appendFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const HOME_DIR = homedir();
if (!HOME_DIR) {
  console.error("[mem-os] ERROR: homedir() returned empty. Check USERPROFILE/USERNAME environment variables.");
}

const LOG_DIR = join(HOME_DIR || ".", ".config", "opencode");
const LOG_FILE = join(LOG_DIR, ".opencode-memos.log");

export let DEBUG = false;

export function setDebug(enabled: boolean) {
  DEBUG = enabled;
}

let loggerReady = false;
try {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
  writeFileSync(LOG_FILE, `\n--- Session started: ${new Date().toISOString()} ---\n`, { flag: "a" });
  loggerReady = true;
} catch (e) {
  // Log to stderr for initialization errors - these are critical
  console.error("[mem-os] Failed to initialize logger. LOG_DIR:", LOG_DIR, "Error:", e);
}

export function log(message: string, data?: unknown) {
  if (!loggerReady) {
    // Try to re-initialize
    try {
      if (!existsSync(LOG_DIR)) {
        mkdirSync(LOG_DIR, { recursive: true });
      }
      writeFileSync(LOG_FILE, `\n--- Session started: ${new Date().toISOString()} ---\n`, { flag: "a" });
      loggerReady = true;
    } catch {}
  }
  
  if (loggerReady) {
    try {
      const timestamp = new Date().toISOString();
      const line = data 
        ? `[${timestamp}] ${message}: ${JSON.stringify(data)}\n`
        : `[${timestamp}] ${message}\n`;
      appendFileSync(LOG_FILE, line);
    } catch {}
  }
}

export function debug(message: string, data?: unknown) {
  if (DEBUG) {
    if (!loggerReady) {
      // Try to re-initialize
      try {
        if (!existsSync(LOG_DIR)) {
          mkdirSync(LOG_DIR, { recursive: true });
        }
        writeFileSync(LOG_FILE, `\n--- Session started: ${new Date().toISOString()} ---\n`, { flag: "a" });
        loggerReady = true;
      } catch {}
    }
    
    if (loggerReady) {
      try {
        const timestamp = new Date().toISOString();
        const line = data 
          ? `[${timestamp}] [DEBUG] ${message}: ${JSON.stringify(data)}\n`
          : `[${timestamp}] [DEBUG] ${message}\n`;
        appendFileSync(LOG_FILE, line);
      } catch {}
    }
  }
}
