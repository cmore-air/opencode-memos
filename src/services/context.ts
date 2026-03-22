import type {
  SearchMemoryResponse,
  MemoryDetail,
  PreferenceDetail,
  ToolMemoryDetail,
} from "../types/index.js";

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value != null && typeof value === "object") {
    const content = (value as { content?: string }).content;
    if (typeof content === "string") return content;
    return JSON.stringify(value);
  }
  return String(value ?? "");
}

export function formatContextForPrompt(
  searchResult: SearchMemoryResponse | null
): string {
  const parts: string[] = ["[MEMOS]"];

  if (!searchResult) {
    return "";
  }

  const { memory_detail_list, preference_detail_list, tool_memory_detail_list } =
    searchResult;

  const memories: MemoryDetail[] = memory_detail_list || [];
  if (memories.length > 0) {
    parts.push("\nFacts:");
    memories.forEach((mem) => {
      const confidence = Math.round((mem.confidence ?? 0) * 100);
      parts.push(`- [${confidence}%] ${mem.memory_value}`);
    });
  }

  const preferences: PreferenceDetail[] = preference_detail_list || [];
  if (preferences.length > 0) {
    parts.push("\nPreferences:");
    preferences.forEach((pref) => {
      const typeTag = pref.preference_type === "explicit_preference" ? "explicit" : "implicit";
      parts.push(`- [${typeTag}] ${pref.preference}`);
    });
  }

  const toolMemories: ToolMemoryDetail[] = tool_memory_detail_list || [];
  if (toolMemories.length > 0) {
    parts.push("\nTool Memories:");
    toolMemories.forEach((tm) => {
      const relativity = Math.round((tm.relativity ?? 0) * 100);
      parts.push(`- [${relativity}%] ${tm.tool_value}`);
    });
  }

  if (parts.length === 1) {
    return "";
  }

  return parts.join("\n");
}
