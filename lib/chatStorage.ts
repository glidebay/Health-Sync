'use client';


const STORAGE_KEY = 'healthsync_chat_read_state_v1';

export function getReadThreadStates(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function markThreadAsRead(threadId: string, messageCount: number) {
  if (typeof window === 'undefined' || !threadId) return;
  try {
    const current = getReadThreadStates();
    current[threadId] = Math.max(current[threadId] || 0, messageCount);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(
      new CustomEvent('healthsync_chat_read_change', {
        detail: { threadId, messageCount },
      })
    );
  } catch {}
}

export function isThreadUnread(
  thread: { id: string; messages: any[] },
  readStates: Record<string, number>
): boolean {
  if (!thread || !thread.messages) return false;
  const readCount = readStates[thread.id];
  if (readCount === undefined) {
    return thread.messages.length > 0;
  }
  return thread.messages.length > readCount;
}

export function countUnreadPersons(
  threads: Array<{ id: string; messages: any[] }>,
  readStates: Record<string, number>
): number {
  if (!threads || !Array.isArray(threads)) return 0;
  return threads.filter((t) => isThreadUnread(t, readStates)).length;
}
