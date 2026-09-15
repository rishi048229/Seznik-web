const DB_ERROR_PATTERNS = [
  /prisma/i,
  /foreign key constraint/i,
  /unique constraint/i,
  /syntax error/i,
  /database error/i,
  /internal server error/i,
  /p2002/i,
  /p2003/i,
  /p2025/i,
  /failed to fetch/i,
  /networkerror/i,
];

export function toUserMessage(err: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (!err) return fallback;

  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err instanceof Error) {
    raw = err.message;
  } else if (typeof err === 'object' && err !== null && 'error' in err) {
    raw = String((err as { error: unknown }).error);
  }

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  for (const pattern of DB_ERROR_PATTERNS) {
    if (pattern.test(trimmed)) {
      return fallback;
    }
  }

  return trimmed;
}
