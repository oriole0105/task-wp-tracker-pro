import { useCallback, useEffect } from 'react';
import { api } from '../services/apiClient';
import { useTaskStore } from '../store/useTaskStore';
import type { ServerExportData } from '../store/useTaskStore';

export function useApiHydration() {
  const hydrate = useTaskStore(s => s._hydrate);
  const setOffline = useTaskStore(s => s._setOffline);
  const setBootstrapRequired = useTaskStore(s => s._setBootstrapRequired);

  const doHydrate = useCallback(async () => {
    try {
      const result = await api.get<{ ok: boolean; data: ServerExportData }>('/data/export');
      if (result.ok && result.data) {
        hydrate(result.data);
      }
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [hydrate, setOffline]);

  useEffect(() => {
    fetch('/system/health')
      .then(r => r.json())
      .then((health: { data?: { bootstrapRequired?: boolean } }) => {
        if (health?.data?.bootstrapRequired) {
          setBootstrapRequired(true);
        } else {
          void doHydrate();
        }
      })
      .catch(() => {
        setOffline(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { doHydrate };
}
