// CSS target-counter() collection — port of weasyprint/css/targets.py.
// Anchors (id -> page) are registered during layout; page content such as
// `content: target-counter(attr(href), page)` resolves through this class.
import { formatCounter } from './counters.js';

export interface TargetInfo { page: number }

function normalizeId(raw: string): string {
  let id = raw.trim();
  if ((id.startsWith('"') && id.endsWith('"')) || (id.startsWith("'") && id.endsWith("'"))) {
    id = id.slice(1, -1);
  }
  const urlM = /^url\(\s*(.*)\s*\)$/i.exec(id);
  if (urlM) {
    let inner = urlM[1].trim();
    if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
      inner = inner.slice(1, -1);
    }
    id = inner;
  }
  const hash = id.indexOf('#');
  if (hash >= 0) id = id.slice(hash + 1);
  return id.trim();
}

export class TargetCollector {
  private anchors = new Map<string, TargetInfo>();
  private pending = new Map<string, string>();

  registerAnchor(id: string, pageNumber: number): void {
    const key = normalizeId(id);
    if (!key) return;
    const page = Math.trunc(pageNumber);
    if (!Number.isFinite(page) || page < 1) return;
    this.anchors.set(key, { page });
  }

  /** Remember a raw target reference (e.g. `#foo`) for later resolution. */
  registerReference(fromId: string, rawTarget: string): void {
    this.pending.set(fromId, normalizeId(rawTarget));
  }

  lookupTarget(id: string): TargetInfo | null {
    const key = normalizeId(id);
    if (!key) return null;
    return this.anchors.get(key) ?? null;
  }

  has(id: string): boolean {
    return this.lookupTarget(id) !== null;
  }

  /** Format the target's page number with a counter style (`page` default). */
  formatTarget(id: string, style = 'decimal'): string {
    const t = this.lookupTarget(id);
    if (!t) return '';
    void style;
    // `page` counter renders as decimal regardless of requested style alias.
    const s = style.trim().toLowerCase() || 'decimal';
    return formatCounter(t.page, s === 'page' ? 'decimal' : s);
  }

  /** Counter value for `target-counter(id, page)` — 0 when missing. */
  targetPage(id: string): number {
    return this.lookupTarget(id)?.page ?? 0;
  }

  clear(): void {
    this.anchors.clear();
    this.pending.clear();
  }

  get size(): number {
    return this.anchors.size;
  }
}
