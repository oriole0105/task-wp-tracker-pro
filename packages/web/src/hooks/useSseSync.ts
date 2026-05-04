import { useEffect, useRef } from 'react';
import { api } from '../services/apiClient';
import { useTaskStore } from '../store/useTaskStore';

const SSE_EVENT_TYPES = [
  'task.created', 'task.updated', 'task.deleted', 'tasks.updated',
  'timeslot.created', 'timeslot.updated', 'timeslot.deleted',
  'todo.created', 'todo.updated', 'todo.deleted', 'todos.updated',
  'settings.updated', 'data.imported', 'data.merged',
];

export function useSseSync(doHydrate: () => Promise<void>) {
  const hydrated = useTaskStore(s => s._hydrated);
  const offline = useTaskStore(s => s._offline);
  const doHydrateRef = useRef(doHydrate);
  doHydrateRef.current = doHydrate;

  useEffect(() => {
    if (!hydrated || offline) return;

    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    let delay = 5000;

    const onEvent = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void doHydrateRef.current(), 1000);
    };

    const connect = async () => {
      if (!active) return;
      try {
        const url = await api.sseUrl();
        es = new EventSource(url);
        SSE_EVENT_TYPES.forEach(t => es!.addEventListener(t, onEvent));
        es.onopen = () => { delay = 5000; };
        es.onerror = () => {
          es?.close();
          if (active) {
            setTimeout(connect, delay);
            delay = Math.min(delay * 2, 60_000);
          }
        };
      } catch {
        if (active) {
          setTimeout(connect, delay);
          delay = Math.min(delay * 2, 60_000);
        }
      }
    };

    void connect();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, [hydrated, offline]);
}
