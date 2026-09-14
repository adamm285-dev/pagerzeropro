/**
 * Extracts a 4-digit security PIN from spoken transcripts or text.
 * Supports:
 * - 4 contiguous digits: "1234", "code is 1234"
 * - Spaced digits: "1 2 3 4"
 * - Spoken number words: "one two three four"
 */
export function extractSpokenPin(text: string): string | null {
  if (!text) return null;

  // 1. Contiguous 4 digits
  const match4 = text.match(/\b\d{4}\b/);
  if (match4) return match4[0];

  // 2. 4 separated single digits e.g. "1 2 3 4"
  const matchSpaced = text.match(/\b(\d)\s+(\d)\s+(\d)\s+(\d)\b/);
  if (matchSpaced) return `${matchSpaced[1]}${matchSpaced[2]}${matchSpaced[3]}${matchSpaced[4]}`;

  // 3. Spoken number words e.g. "one two three four"
  const wordMap: Record<string, string> = {
    zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9'
  };
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const digits: string[] = [];
  for (const w of words) {
    if (wordMap[w] !== undefined) {
      digits.push(wordMap[w]);
    } else if (/^\d$/.test(w)) {
      digits.push(wordMap[w]);
    }
  }
  if (digits.length >= 4) {
    return digits.slice(0, 4).join('');
  }
  return null;
}
