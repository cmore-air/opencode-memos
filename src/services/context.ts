import type {
  SearchMemoryResponse,
  MemoryDetail,
  PreferenceDetail,
  ToolMemoryDetail,
} from "../types/index.js";

interface CategorizedMemories {
  workingMemories: MemoryDetail[];
  longTermMemories: MemoryDetail[];
  userMemories: MemoryDetail[];
  explicitPreferences: PreferenceDetail[];
  implicitPreferences: PreferenceDetail[];
  toolMemories: ToolMemoryDetail[];
}

function categorizeMemories(
  memories: MemoryDetail[],
  preferences: PreferenceDetail[],
  toolMemories: ToolMemoryDetail[]
): CategorizedMemories {
  return {
    workingMemories: memories.filter(m => m.memory_type === "WorkingMemory"),
    longTermMemories: memories.filter(m => m.memory_type === "LongTermMemory"),
    userMemories: memories.filter(m => m.memory_type === "UserMemory"),
    explicitPreferences: preferences.filter(p => p.preference_type === "explicit_preference"),
    implicitPreferences: preferences.filter(p => p.preference_type === "implicit_preference"),
    toolMemories: toolMemories,
  };
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
  const preferences: PreferenceDetail[] = preference_detail_list || [];
  const toolMems: ToolMemoryDetail[] = tool_memory_detail_list || [];

  if (memories.length === 0 && preferences.length === 0 && toolMems.length === 0) {
    return "";
  }

  const categorized = categorizeMemories(memories, preferences, toolMems);

  if (categorized.longTermMemories.length > 0) {
    parts.push("\nLong-term Knowledge:");
    categorized.longTermMemories.forEach((mem) => {
      const confidence = Math.round((mem.confidence ?? 0) * 100);
      parts.push(`- [${confidence}%] ${mem.memory_value}`);
    });
  }

  if (categorized.workingMemories.length > 0) {
    parts.push("\nRecent Context:");
    categorized.workingMemories.forEach((mem) => {
      const confidence = Math.round((mem.confidence ?? 0) * 100);
      parts.push(`- [${confidence}%] ${mem.memory_value}`);
    });
  }

  if (categorized.userMemories.length > 0) {
    parts.push("\nUser Information:");
    categorized.userMemories.forEach((mem) => {
      const confidence = Math.round((mem.confidence ?? 0) * 100);
      parts.push(`- [${confidence}%] ${mem.memory_value}`);
    });
  }

  if (categorized.explicitPreferences.length > 0) {
    parts.push("\nExplicit Preferences:");
    categorized.explicitPreferences.forEach((pref) => {
      parts.push(`- [explicit] ${pref.preference}`);
    });
  }

  if (categorized.implicitPreferences.length > 0) {
    parts.push("\nImplicit Preferences:");
    categorized.implicitPreferences.forEach((pref) => {
      parts.push(`- [implicit] ${pref.preference}`);
    });
  }

  if (categorized.toolMemories.length > 0) {
    parts.push("\nTool Usage Experience:");
    categorized.toolMemories.forEach((tm) => {
      const relativity = Math.round((tm.relativity ?? 0) * 100);
      parts.push(`- [${relativity}%] ${tm.tool_value}`);
    });
  }

  if (parts.length === 1) {
    return "";
  }

  return parts.join("\n");
}
