/**
 * Parses a user-typed "starting label" like "0001" or "A01" or "INV-001" into a fixed prefix, a
 * zero-padded numeric core (whose exact digit-width is preserved for padding), and a fixed suffix
 * — then lets the numeric core alone be incremented per label while everything else stays put.
 * One parser handles both the plain zero-padded case ("0001"→"0002") and the alphanumeric-prefix
 * case ("A01"→"A02") without needing separate UI modes for each.
 */

export interface ParsedSequencePattern {
  prefix: string;
  numStr: string;
  suffix: string;
}

/** Hard ceiling on a single sequence print run — matches the cap the original ad-hoc
 *  Label Studio "Sequential Number Printing" feature already used. */
export const MAX_SEQUENCE_COUNT = 200;

/**
 * Splits `pattern` at its LAST contiguous run of digits (lazy prefix + greedy digit run + whatever
 * remains as suffix). Returns null when the pattern has no digits at all — there's nothing to
 * increment, so the caller should show a validation error rather than guess.
 */
export function parseSequencePattern(pattern: string): ParsedSequencePattern | null {
  const match = /^(.*?)(\d+)(\D*)$/s.exec(pattern);
  if (!match) return null;
  return { prefix: match[1], numStr: match[2], suffix: match[3] };
}

/** Renders the value for the `index`-th label in the run (0 = the starting pattern itself). */
export function formatSequenceValue(parsed: ParsedSequencePattern, index: number): string {
  const next = parseInt(parsed.numStr, 10) + index;
  const nextStr = String(next);
  const padded = nextStr.length >= parsed.numStr.length ? nextStr : nextStr.padStart(parsed.numStr.length, '0');
  return `${parsed.prefix}${padded}${parsed.suffix}`;
}
