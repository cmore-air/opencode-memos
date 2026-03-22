export interface MemOSTags {
  conversationId: string;
}

export function getConversationId(sessionId: string): string {
  return sessionId;
}

export function getTags(sessionId: string): MemOSTags {
  return {
    conversationId: getConversationId(sessionId),
  };
}
