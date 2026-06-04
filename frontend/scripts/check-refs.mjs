#!/usr/bin/env node
/**
 * Build-time guardrail for the Mongoose populate() / ._id === anti-pattern.
 *
 * Scans frontend/src/** for unsafe ref comparisons like:
 *   n.job === someId
 *   n.application === app._id
 *   arr.find(x => x.field === someId)
 *   arr.some(x => x.field === someId)
 *   arr.filter(x => x.field === someId)
 *   ids.includes(obj.field)
 *
 * Exits non-zero (failing the build) if any are found outside the
 * allowlist (lib/api.js is the home of the refId() helper itself).
 *
 * Run via: `npm run lint:refs` or automatically before `npm run build`.
 *
 * Why a grep check instead of ESLint:
 *   - Zero new dependencies
 *   - Catches the pattern regardless of JS style (arrow vs function, etc.)
 *   - Runs in <1s on this codebase
 *   - Failure message points directly at the file:line
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const ALLOWLIST = new Set([
  // The helper itself and its tests — these define the safe pattern.
  join('src', 'lib', 'api.js'),
]);
// Fields we know are NOT populated anywhere in the codebase.
// Safe to compare against ._id directly. Source: docs/POPULATE_CONTRACT.md.
const SAFE_POPULATED_FIELDS = new Set([
  // Notification._id is always a top-level string, never populated.
  '_id',
  // Application._id is always a top-level string, never populated.
  // (The "application" field on other docs IS populated, but a local
  //  variable named `applicationId` is a raw id by convention.)
]);

// Pattern: any access of a .field compared with ===, !==, or used with
// Array.prototype methods, where `field` is not in the safe list.
// We look for these specific callsite shapes:
//
//   <expr>.<field> === <id>
//   <id> === <expr>.<field>
//   <expr>.<field> !== <id>
//   .includes(<expr>.<field>)
//   .find(x => x.<field> === ...)
//   .some(x => x.<field> === ...)
//   .filter(x => x.<field> === ...)
//
// We whitelist when the field is preceded by `refId(` or ends in `?._id`
// of the local variable (which we can't statically tell, so we lean on
// the developer using `refId()` for any populated field).
const POPULATED_FIELD_NAMES = [
  // From docs/POPULATE_CONTRACT.md — fields that ARE populated somewhere.
  'job', 'application', 'student', 'officer', 'user', 'postedBy',
  'company', 'savedJobs',
];

// The field name is the LAST token before ===/!==, or the LAST token
// inside .includes(...). So we look for: \.<field>\b followed by
// optional whitespace and then a comparison operator or closing paren.
//
// This regex requires the field to be IMMEDIATELY followed by a
// comparison operator (with optional whitespace). This rules out
// chained property access like `app.student.studentProfile?.x !== y`
// where `student` is just an intermediate hop, not the value being
// compared. Only matches `someVar.<field> ===` and `=== someVar.<field>`
// (the second shape is covered by checking chars before the match).
// Forward direction: `<expr>.<field> === <id>` (the field is on the LEFT of the operator)
const EQ_FIELD_FORWARD_RE = new RegExp(
  `\\.(${POPULATED_FIELD_NAMES.join('|')})\\b\\s*(===|!==|==|!=)`,
  'g'
);
// Reverse direction: `<id> === <expr>.<field>` (the field is on the RIGHT of the operator)
const EQ_FIELD_REVERSE_RE = new RegExp(
  `(===|!==|==|!=)\\s*([^=+\\-*/%&|<>!\\s][^=+\\-*/%&|<>!]*?\\.(${POPULATED_FIELD_NAMES.join('|')})\\b)`,
  'g'
);
const INCLUDES_RE = new RegExp(
  `\\.includes\\([^)]*\\.(${POPULATED_FIELD_NAMES.join('|')})\\b`,
  'g'
);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(jsx?|tsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
let totalOffenses = 0;
const report = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (ALLOWLIST.has(rel)) continue;
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    // Skip pure comment lines (rough heuristic — a // starts the line).
    const stripped = line.trim();
    if (stripped.startsWith('//') || stripped.startsWith('*')) return;

    // If the line already does a typeof check, OR uses refId(), OR
    // uses the ?._id safe pattern, treat the whole line as safe.
    // (Common pattern: a ternary that branches on populated vs raw.)
    const hasSafeGuard =
      line.includes('typeof ') ||
      line.includes('?._id') ||
      line.includes('refId(') ||
      line.includes('refsEqual(');
    if (hasSafeGuard) return;

    // Match .<field> directly compared with ===/!== (either side of op).
    let m;
    EQ_FIELD_FORWARD_RE.lastIndex = 0;
    while ((m = EQ_FIELD_FORWARD_RE.exec(line)) !== null) {
      report.push({ file: rel, line: i + 1, text: line.trim(), match: m[0] });
      totalOffenses++;
    }
    EQ_FIELD_REVERSE_RE.lastIndex = 0;
    while ((m = EQ_FIELD_REVERSE_RE.exec(line)) !== null) {
      report.push({ file: rel, line: i + 1, text: line.trim(), match: m[0] });
      totalOffenses++;
    }
    // Match .includes(populatedField) — always unsafe.
    INCLUDES_RE.lastIndex = 0;
    while ((m = INCLUDES_RE.exec(line)) !== null) {
      report.push({ file: rel, line: i + 1, text: line.trim(), match: m[0] });
      totalOffenses++;
    }
  });
}

if (totalOffenses === 0) {
  console.log('✅ ref-check: no unsafe ref comparisons found.');
  process.exit(0);
}

console.error(`\n❌ ref-check: found ${totalOffenses} unsafe ref comparison(s).\n`);
console.error('These may compare a populated object against a raw id, which');
console.error('silently returns false. Use refId() from lib/api.js instead.\n');
console.error('See docs/POPULATE_CONTRACT.md for the full list of populated');
console.error('fields per endpoint, and why this fails silently.\n');

for (const { file, line, text, match } of report) {
  console.error(`  ${file}:${line}`);
  console.error(`    ${text}`);
  console.error(`    ⚠️  matched: ${match}\n`);
}

console.error('Fix: wrap the populated field with refId() — e.g.');
console.error('  notifications.filter(n => refId(n.job) === jobId)\n');

process.exit(1);
