/** Debug session logging — folds away after verification. */
export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string
): void {
  const payload = {
    sessionId: '19a436',
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
  };
  // Metro fallback when device cannot reach host ingest (physical phone)
  console.warn('[DEBUG-19a436]', JSON.stringify(payload));
  // #region agent log
  fetch('http://127.0.0.1:7722/ingest/0537f56e-340c-424c-a5a0-4b902a475e4b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '19a436' },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}
