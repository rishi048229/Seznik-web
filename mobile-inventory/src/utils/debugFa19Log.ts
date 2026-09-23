import { fetchApi } from '@/api/client';

const INGEST =
  'http://127.0.0.1:7632/ingest/3ea0c578-30b5-49c8-ad99-099230daa1de';

export function debugFa19Log(payload: {
  location: string;
  message: string;
  hypothesisId?: string;
  runId?: string;
  data?: Record<string, unknown>;
}): void {
  const body = {
    sessionId: 'fa19dc',
    timestamp: Date.now(),
    ...payload,
  };
  // #region agent log
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fa19dc' },
    body: JSON.stringify(body),
  }).catch(() => {});
  fetchApi('/debug/log', { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
  // #endregion
}
