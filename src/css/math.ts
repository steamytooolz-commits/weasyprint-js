// CSS math + variables — mirrors parts of weasyprint/css/tokens.py,
// computed_values.py and variables handling (var(), calc(), min(), max(),
// clamp()). Pure-TS evaluator producing px numbers for layout/paint.
import { toPx } from './units.js';

export interface LengthCtx {
  fontPx?: number;
  rootPx?: number;
  /** Reference length for percentages (containing block, page, …). */
  refPx?: number | null;
}

/** Split function args on top-level commas (respect nesting/quotes). */
function splitArgs(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      cur += ch;
      if (ch === quote && body[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * Evaluate a CSS length-ish value to px. Handles plain lengths, `var()`
 * (via `vars`), and nested calc()/min()/max()/clamp(). Percentages need
 * `ctx.refPx`, otherwise they fail (caller falls back).
 */
export function evaluateLengthToPx(
  raw: string,
  ctx: LengthCtx = {},
  vars: Record<string, string> = {},
): number | null {
  let value = raw.trim();
  if (!value) return null;
  if (value.includes('var(')) {
    const resolved = resolveVars(value, vars);
    if (resolved == null) return null;
    value = resolved;
  }
  const low = value.toLowerCase();
  if (low === 'auto' || low === 'none' || low === 'normal' || low === 'content') return null;
  // Plain number with unit or %.
  const plain = lengthToPx(value, ctx);
  if (plain != null) return plain;
  const m = /^(calc|min|max|clamp)\(/i.exec(value);
  if (!m || !value.endsWith(')')) return null;
  const fn = m[1].toLowerCase();
  const body = value.slice(m[0].length, -1);
  try {
    if (fn === 'calc') return evalSum(body, ctx, vars);
    if (fn === 'clamp') return evaluateClamp(value, ctx, vars);
    const args = splitArgs(body).map((a) => evalSum(a, ctx, vars));
    if (args.some((a) => a == null)) return null;
    const nums = args as number[];
    if (fn === 'min') return Math.min(...nums);
    if (fn === 'max') return Math.max(...nums);
    return null;
  } catch {
    return null;
  }
}

export function evaluateClamp(
  raw: string, ctx: LengthCtx = {}, vars: Record<string, string> = {},
): number | null {
  const m = /^clamp\(/i.exec(raw.trim());
  if (!m || !raw.trim().endsWith(')')) return null;
  const args = splitArgs(raw.trim().slice(m[0].length, -1));
  if (args.length !== 3) return null;
  const vals = args.map((a) => evalSum(a, ctx, vars));
  if (vals.some((v) => v == null)) return null;
  const [lo, v, hi] = vals as number[];
  return Math.min(Math.max(v, lo), hi);
}

function evalSum(expr: string, ctx: LengthCtx, vars: Record<string, string>): number | null {
  // Tokenize on top-level + / - (* and / per spec; support them too).
  const tokens: string[] = [];
  let depth = 0;
  let cur = '';
  const push = (): void => { if (cur.trim()) tokens.push(cur.trim()); cur = ''; };
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (depth === 0 && (ch === '+' || ch === '-' || ch === '*' || ch === '/')) {
      push();
      tokens.push(ch);
      continue;
    }
    cur += ch;
  }
  push();
  if (tokens.length === 0) return null;
  // Resolve operands (nested math fns, lengths, numbers).
  const vals: Array<number | string> = tokens.map((t) => {
    if (t === '+' || t === '-' || t === '*' || t === '/') return t;
    if (/^(calc|min|max|clamp)\(/i.test(t)) {
      const v = t.toLowerCase().startsWith('clamp')
        ? evaluateClamp(t, ctx, vars)
        : evaluateLengthToPx(t, ctx, vars);
      return v == null ? NaN : v;
    }
    if (t.startsWith('(') && t.endsWith(')')) {
      const v = evalSum(t.slice(1, -1), ctx, vars);
      return v == null ? NaN : v;
    }
    const n = lengthToPx(t, ctx);
    if (n != null) return n;
    // Bare number (allowed as factor for * and /).
    const f = parseFloat(t);
    if (Number.isFinite(f) && /^[-+]?(\d*\.?\d+)$/.test(t.trim())) return f;
    return NaN;
  });
  // * and / first.
  const reduced: Array<number | string> = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v === '*' || v === '/') {
      const a = reduced.pop() as number;
      const b = vals[++i] as number;
      if (typeof a !== 'number' || typeof b !== 'number' || Number.isNaN(a) || Number.isNaN(b)) return null;
      if (v === '/' && b === 0) return null; // spec: division by zero → infinity; fail safe
      reduced.push(v === '*' ? a * b : a / b);
    } else {
      reduced.push(v);
    }
  }
  let total: number | null = null;
  let op = '+';
  for (const v of reduced) {
    if (v === '+' || v === '-') { op = v; continue; }
    if (typeof v !== 'number' || Number.isNaN(v)) return null;
    total = total == null ? (op === '+' ? v : -v) : op === '+' ? total + v : total - v;
    op = '+';
  }
  return total;
}

function lengthToPx(token: string, ctx: LengthCtx): number | null {
  const t = token.trim().toLowerCase();
  if (t === '0') return 0;
  if (t.endsWith('%')) {
    if (ctx.refPx == null) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? (n / 100) * ctx.refPx : null;
  }
  const m = /^(-?[0-9]*\.?[0-9]+)(px|pt|pc|in|cm|mm|q|em|rem|ex|ch|cap|lh|vw|vh|vmin|vmax)?$/.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = (m[2] ?? 'px').toLowerCase();
  if (u === 'em') return n * (ctx.fontPx ?? 16);
  if (u === 'rem') return n * (ctx.rootPx ?? 16);
  if (u === 'ex' || u === 'ch' || u === 'cap') return n * (ctx.fontPx ?? 16) * 0.5;
  if (u === 'lh') return n * (ctx.fontPx ?? 16) * 1.2;
  if (u === 'vw' || u === 'vh' || u === 'vmin' || u === 'vmax') return null; // no viewport in print
  return toPx(n, u, { fontSize: ctx.fontPx ?? 16, rootFontSize: ctx.rootPx ?? 16 });
}

/** Resolve var(--name, fallback) references using inherited custom props. */
export function resolveVars(value: string, vars: Record<string, string>): string | null {
  let out = value;
  for (let guard = 0; guard < 10; guard++) {
    const idx = out.indexOf('var(');
    if (idx < 0) return out;
    const end = matchParen(out, idx + 3);
    if (end < 0) return null;
    const inner = out.slice(idx + 4, end);
    const parts = splitArgs(inner);
    const name = (parts[0] ?? '').trim();
    let replacement: string | null = null;
    if (name.startsWith('--') && vars[name] != null) {
      replacement = vars[name];
    } else if (parts.length > 1) {
      replacement = parts.slice(1).join(',').trim() || null;
    }
    if (replacement == null) return null; // guaranteed-invalid
    out = out.slice(0, idx) + replacement + out.slice(end + 1);
  }
  return null; // cycle
}

function matchParen(s: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** True when the value needs layout context (var/math/%) to resolve. */
export function isComplexValue(value: string): boolean {
  const v = value.toLowerCase();
  return v.includes('var(') || /^(calc|min|max|clamp)\(/.test(v.trim()) || /[+\-*/]/.test(v) && v.includes('%');
}
