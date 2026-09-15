import type { Response } from 'express';

export interface ApiErrorOptions {
  fallbackMessage?: string;
  statusCode?: number;
}

/**
 * Maps raw backend/database/Prisma errors into clean, user-friendly messages
 * with appropriate HTTP status codes, preventing database internals or stack
 * traces from being sent to clients.
 */
export function formatErrorMessage(
  error: unknown,
  fallbackMessage = 'An unexpected server error occurred. Please try again.'
): { message: string; statusCode: number } {
  if (!error) {
    return { message: fallbackMessage, statusCode: 500 };
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : (error as any)?.message || String(error);

  const lower = raw.toLowerCase();

  // 1. Prisma P2002: Unique constraint violation
  if (
    lower.includes('unique constraint') ||
    lower.includes('p2002') ||
    lower.includes('duplicate key') ||
    lower.includes('already exists')
  ) {
    if (lower.includes('phone') || lower.includes('mobile')) {
      return { message: 'A record with this phone number already exists.', statusCode: 409 };
    }
    if (lower.includes('email')) {
      return { message: 'An account with this email address already exists.', statusCode: 409 };
    }
    if (lower.includes('code') || lower.includes('barcode')) {
      return { message: 'An item or code with this value already exists.', statusCode: 409 };
    }
    return { message: 'A record with these unique details already exists.', statusCode: 409 };
  }

  // 2. Prisma P2003 / P2014: Foreign key dependency violation
  if (
    lower.includes('foreign key constraint') ||
    lower.includes('p2003') ||
    lower.includes('p2014') ||
    lower.includes('violates foreign key')
  ) {
    return {
      message: 'Cannot perform this action because this item is linked to existing records or transactions.',
      statusCode: 400,
    };
  }

  // 3. Prisma P2025: Record not found
  if (lower.includes('record to update not found') || lower.includes('record to delete not found') || lower.includes('p2025')) {
    return { message: 'The requested record was not found or has already been removed.', statusCode: 404 };
  }

  // 4. Insufficient Stock
  if (raw === 'INSUFFICIENT_STOCK' || lower.includes('insufficient stock')) {
    return { message: 'Insufficient stock available for this operation.', statusCode: 400 };
  }

  // 5. Connection / DB ping / Timeout
  if (
    lower.includes('econnrefused') ||
    lower.includes('connection refused') ||
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('database ping failed') ||
    lower.includes('cannot connect')
  ) {
    return {
      message: 'Database service is currently taking longer than expected. Please try again shortly.',
      statusCode: 503,
    };
  }

  // If the error message is already human-friendly and safe (no technical keywords or stack lines)
  const isTechnical =
    /prisma|column\s|does not exist|unknown argument|sqlstate|constraint|relation\s|invalid `prisma|stack trace|null value|foreign key|syntaxerror|typeerror|referenceerror|at\s+\w+/i.test(
      raw
    );

  if (!isTechnical && raw.length > 5 && raw.length < 150) {
    return { message: raw, statusCode: 400 };
  }

  return { message: fallbackMessage, statusCode: 500 };
}

/**
 * Centralized API Error Response Handler for Express controllers.
 * Automatically logs the raw error to server logs and returns clean JSON.
 */
export function handleApiError(
  res: Response,
  error: unknown,
  fallbackMessage = 'An unexpected server error occurred. Please try again.',
  overrideStatusCode?: number
) {
  console.error('[API Error]:', error);
  const { message, statusCode } = formatErrorMessage(error, fallbackMessage);
  return res.status(overrideStatusCode || statusCode).json({ error: message });
}
