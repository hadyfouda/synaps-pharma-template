// Robust name matching for linking active users (DB) → legacy records (Data).
// Handles: case-insensitivity, trailing/leading spaces, Arabic diacritics,
// middle-name discrepancies (matches by first + last token), and
// partial / substring containment.

/** Normalize a name: lowercase, strip Arabic diacritics, unify alif/ya/ta marbuta,
 * remove trailing code-like suffixes, collapse whitespace. */
export function normalizeName(s: string): string {
  const cleaned = (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)\s*$/g, "") // trailing legacy area notes
    .replace(/[\u064B-\u0652]/g, "") // Arabic diacritics
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\s\-_/|]*\(?\d{3,}\)?\s*$/g, "") // trailing numeric codes
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  const tokens = cleaned.split(" ");
  const latin = tokens.filter((t) => /^[a-z0-9]+$/.test(t));
  if (latin.length >= 2 && latin.length < tokens.length) {
    return latin.join(" ");
  }
  return cleaned;
}

export function tokenize(s: string): string[] {
  return normalizeName(s).split(" ").filter(Boolean);
}

export function looseNameMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = na.split(" ");
  const tb = nb.split(" ");
  if (ta.length && tb.length && ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1]) {
    return true;
  }
  if (!tokensSimilar(ta[0], tb[0])) return false;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let hits = 0;
  for (const t of setA) {
    if (setB.has(t)) hits++;
    else for (const u of setB) { if (tokensSimilar(t, u)) { hits++; break; } }
  }
  return hits >= 2;
}

function tokensSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  return levenshtein(a, b) <= 1;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

export function findLooseMatch<T>(
  query: string,
  candidates: T[],
  getName: (c: T) => string,
): T | undefined {
  const nq = normalizeName(query);
  if (!nq) return undefined;

  for (const c of candidates) {
    if (normalizeName(getName(c)) === nq) return c;
  }
  const tq = nq.split(" ");
  if (tq.length >= 2) {
    const first = tq[0];
    const last = tq[tq.length - 1];
    for (const c of candidates) {
      const tc = normalizeName(getName(c)).split(" ");
      if (tc.length >= 2 && tc[0] === first && tc[tc.length - 1] === last) return c;
    }
    for (const c of candidates) {
      const tokenSet = new Set(normalizeName(getName(c)).split(" "));
      const required = first === last ? [...new Set(tq)] : [first, last];
      if (required.every((token) => tokenSet.has(token))) return c;
    }
    for (const c of candidates) {
      const tc = normalizeName(getName(c)).split(" ");
      if (tc.length >= 2 && tc[0] === first && tokensSimilar(tc[tc.length - 1], last)) return c;
    }
  }
  for (const c of candidates) {
    if (looseNameMatch(getName(c), query)) return c;
  }
  return undefined;
}
