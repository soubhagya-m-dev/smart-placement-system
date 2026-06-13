/**
 * Parse a free-form CTC string from the officer's offer-letter form into a Number in LPA.
 *
 * Accepts:
 *   "8 LPA"        -> 8
 *   "8.5 LPA"      -> 8.5
 *   "8L"           -> 8
 *   "₹8,00,000"    -> 8   (Indian numbering: 1 LPA = 1,00,000 ₹)
 *   "₹12,50,000"   -> 12.5
 *   "1500000"      -> 15
 *   "" / null      -> null
 *
 * Heuristic: if the number is >= 100_000, treat the raw rupee value and divide by 100_000.
 * Otherwise (the common case — officer types a small LPA number), use it as LPA directly.
 */
function parseCtcToLpa(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;

  // Strip currency symbols, commas, whitespace, and common unit suffixes
  const cleaned = s
    .replace(/[₹$€£]/g, '')
    .replace(/,/g, '')
    .replace(/\s*(lpa|l\s*\/?\s*a|lakh|lac|l)\b/gi, '')
    .trim();

  const num = parseFloat(cleaned);
  if (!isFinite(num) || num <= 0) return null;

  // Big raw numbers are almost certainly full rupee amounts — convert to LPA.
  // The "8" or "8.5" case will never cross this threshold.
  if (num >= 100000) return +(num / 100000).toFixed(2);

  return +num.toFixed(2);
}

module.exports = { parseCtcToLpa };
