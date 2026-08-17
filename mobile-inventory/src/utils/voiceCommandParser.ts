/**
 * Parses spoken cart commands ("2 bread", "add two bread", "remove 2 breads", "remove all milk")
 * into a structured action against the store's real product list. Built for on-device speech-to-text
 * output (expo-speech-recognition) feeding the POS cart — pure string matching tuned for short
 * retail phrases, not a general NLU/network call, so it stays instant and works fully offline.
 */

export type VoiceCommandAction = 'add' | 'remove' | 'unknown';

export interface VoiceProductRef {
  id: string;
  name: string;
}

export interface ParsedVoiceCommand {
  action: VoiceCommandAction;
  /** Infinity means "all of it" (e.g. "remove all bread") — caller should fully remove the line, not subtract. */
  quantity: number;
  /** The raw spoken item phrase after stripping the action verb + quantity, before product matching. */
  itemPhrase: string;
  matchedProduct: VoiceProductRef | null;
}

// English number words, plus their common Hindi/Hinglish, Gujarati and Marathi romanizations —
// India's on-device speech recognizer (en-IN) routinely transcribes mixed-language retail speech
// ("teen bread", "2 packet aata") phonetically in Latin script rather than translating it, so the
// parser needs to understand those spoken numerals directly rather than expecting pure English.
// Spelling variants are intentionally duplicated (multiple ways the same word gets transcribed).
const NUMBER_WORDS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  a: 1, an: 1, couple: 2, few: 3, dozen: 12, half: 0.5,
  // Hindi / Hinglish (also widely understood/spoken as a bridge language in Gujarat & Maharashtra)
  ek: 1, aik: 1,
  do: 2, dho: 2,
  teen: 3, tin: 3,
  chaar: 4, char: 4,
  paanch: 5, panch: 5, paach: 5,
  chhe: 6, che: 6,
  saat: 7, sat: 7,
  aath: 8, ath: 8,
  nau: 9, nou: 9,
  das: 10, dus: 10,
  gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15,
  solah: 16, satrah: 17, atharah: 18, unnees: 19, bees: 20,
  // Gujarati romanized (where different from Hindi above)
  be: 2, tran: 3, chha: 6, nav: 9,
  // Marathi romanized (where different from Hindi above)
  don: 2, pach: 5, saha: 6, daha: 10,
};

const REMOVE_KEYWORDS = [
  'remove', 'delete', 'cancel', 'take off', 'take out', 'subtract', 'minus',
  // Hindi/Hinglish
  'hatao', 'hata do', 'nikaalo', 'nikalo', 'nikal do', 'ghatao',
  // Gujarati / Marathi
  'kadho', 'kadha', 'kami karo',
];
const ADD_KEYWORDS = [
  'add', 'put', 'include', 'insert',
  // Hindi/Hinglish
  'jodo', 'jod do', 'daal do', 'daalo', 'dalo', 'de do', 'dijiye',
  // Gujarati / Marathi
  'nakho', 'ghala', 'ghal',
];

// Unit/quantity nouns that ride along with a spoken quantity ("2 packet aata", "1 bottle oil",
// "3 kg sugar") — stripped so only the actual product name phrase reaches product matching.
const UNIT_FILLER_WORDS = [
  'packet', 'packets', 'box', 'boxes', 'bottle', 'bottles', 'kg', 'kilo', 'kilos',
  'gram', 'grams', 'gm', 'litre', 'liter', 'litres', 'liters', 'ml', 'piece', 'pieces', 'pcs', 'pc',
];

function extractAction(text: string): { action: VoiceCommandAction; rest: string } {
  for (const kw of REMOVE_KEYWORDS) {
    if (text === kw || text.startsWith(`${kw} `)) return { action: 'remove', rest: text.slice(kw.length).trim() };
  }
  for (const kw of ADD_KEYWORDS) {
    if (text === kw || text.startsWith(`${kw} `)) return { action: 'add', rest: text.slice(kw.length).trim() };
  }
  // No explicit verb, e.g. plain "2 bread" — default to add, matching the plain-quantity example.
  return { action: 'add', rest: text };
}

function extractQuantity(text: string): { quantity: number; rest: string } {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { quantity: 1, rest: text };

  // "remove all bread" / "remove everything" — signals a full line removal, not a subtraction.
  if (words[0] === 'all' || words[0] === 'everything') {
    return { quantity: Infinity, rest: words.slice(1).join(' ') };
  }

  // Digit form: "2 bread"
  const digitMatch = words[0].match(/^\d+(\.\d+)?$/);
  if (digitMatch) {
    return { quantity: parseFloat(words[0]), rest: words.slice(1).join(' ') };
  }

  // Word form: "two bread" / "a dozen eggs" / "half dozen eggs"
  if (words[0] in NUMBER_WORDS) {
    let qty = NUMBER_WORDS[words[0]];
    let consumed = 1;
    if (words[1] === 'dozen') {
      qty *= 12;
      consumed = 2;
    }
    return { quantity: qty, rest: words.slice(consumed).join(' ') };
  }

  return { quantity: 1, rest: text };
}

function stripFillerWords(text: string): string {
  let result = text
    .replace(/^(of|the|some|a|an)\s+/, '')
    .replace(/\s+(please|units?)$/, '')
    .trim();

  // Unit words can appear right after the quantity ("2 packet aata") — strip a single leading one.
  const words = result.split(/\s+/).filter(Boolean);
  if (words.length > 1 && UNIT_FILLER_WORDS.includes(words[0])) {
    result = words.slice(1).join(' ');
  }
  return result.trim();
}

/** Cheap plural stripping — good enough for retail nouns ("breads"->"bread", "batteries"->"battery"). */
function singularize(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/** Levenshtein edit distance — fine for short product-name-length strings, no need for a library. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Matches the spoken item phrase against real product names: exact > prefix > substring > fuzzy
 * (normalized edit-distance similarity, only accepted above 0.72) — covers STT mishearings like
 * "bread" vs "brad" without accidentally matching unrelated short product names.
 */
function matchProduct(phrase: string, products: VoiceProductRef[]): VoiceProductRef | null {
  const spoken = singularize(phrase.trim().toLowerCase());
  if (!spoken) return null;

  let best: VoiceProductRef | null = null;
  let bestScore = -Infinity;

  for (const p of products) {
    const name = p.name.toLowerCase();
    const nameSingular = singularize(name);
    let score = -Infinity;

    if (name === spoken || nameSingular === spoken) {
      score = 1000;
    } else if (name.startsWith(spoken) || nameSingular.startsWith(spoken)) {
      score = 500 - Math.abs(name.length - spoken.length);
    } else if (name.includes(spoken)) {
      score = 300 - Math.abs(name.length - spoken.length);
    } else {
      const dist = levenshtein(spoken, nameSingular);
      const maxLen = Math.max(spoken.length, nameSingular.length);
      const similarity = maxLen > 0 ? 1 - dist / maxLen : 0;
      if (similarity >= 0.72) score = similarity * 200;
    }

    if (score > bestScore) {
      bestScore = score;
      best = { id: p.id, name: p.name };
    }
  }

  return bestScore > -Infinity ? best : null;
}

export function parseVoiceCommand(rawTranscript: string, products: VoiceProductRef[]): ParsedVoiceCommand {
  const normalized = rawTranscript.toLowerCase().trim().replace(/[.,!?]/g, '');
  const { action, rest: afterAction } = extractAction(normalized);
  const { quantity, rest: afterQuantity } = extractQuantity(afterAction.trim());
  const itemPhrase = stripFillerWords(afterQuantity.trim());

  if (!itemPhrase) {
    return { action: 'unknown', quantity, itemPhrase, matchedProduct: null };
  }

  const matchedProduct = matchProduct(itemPhrase, products);
  return {
    action: matchedProduct ? action : 'unknown',
    quantity: quantity || 1,
    itemPhrase,
    matchedProduct,
  };
}

/**
 * Speech recognizers return several alternative transcriptions per utterance (maxAlternatives), not
 * just one — the top-ranked guess is frequently NOT the one that best matches the store's actual
 * product names (e.g. "aata" mis-heard as "atta"/"ata"/"aatha" across alternatives). Trying every
 * alternative and keeping the first one that resolves to a real product meaningfully improves the
 * catch rate over only ever looking at transcripts[0], at zero extra recognition cost.
 */
export function parseVoiceCommandBest(transcripts: string[], products: VoiceProductRef[]): ParsedVoiceCommand {
  let firstAttempt: ParsedVoiceCommand | null = null;
  for (const t of transcripts) {
    if (!t) continue;
    const parsed = parseVoiceCommand(t, products);
    if (!firstAttempt) firstAttempt = parsed;
    if (parsed.matchedProduct) return parsed;
  }
  return firstAttempt || { action: 'unknown', quantity: 1, itemPhrase: '', matchedProduct: null };
}
