export function createConversationTitle(text: string): string {
  const normalized = text
    .split(/\s+/u)
    .filter(Boolean)
    .join(" ")
    .replace(/[.!?]+$/u, "");
  if (!normalized) {
    return "New conversation";
  }
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}
