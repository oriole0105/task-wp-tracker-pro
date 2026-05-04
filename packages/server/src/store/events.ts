type EventPayload = { type: string; payload?: unknown };
type EventListener = (event: EventPayload) => void;

const listeners = new Set<EventListener>();

export function subscribeToEvents(listener: EventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitEvent(type: string, payload?: unknown): void {
  const event: EventPayload = { type, ...(payload !== undefined && { payload }) };
  for (const listener of listeners) {
    try { listener(event); } catch { /* ignore disconnected listeners */ }
  }
}
