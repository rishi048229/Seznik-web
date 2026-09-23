import fs from 'fs';
import path from 'path';

const LOG_PATH = path.resolve(__dirname, '../../../debug-fa19dc.log');

export type DebugFa19Payload = {
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: number;
};

/** Append one NDJSON debug line for session fa19dc (local + deployed backend). */
export function debugFa19Log(payload: DebugFa19Payload): void {
  const line = JSON.stringify({
    sessionId: 'fa19dc',
    timestamp: payload.timestamp ?? Date.now(),
    ...payload,
  });
  try {
    fs.appendFileSync(LOG_PATH, `${line}\n`);
  } catch {
    // ignore filesystem errors on read-only hosts
  }
}
