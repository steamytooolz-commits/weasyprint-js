// CSS target-counter() collection — port of weasyprint/css/targets.py.
// Anchors (id -> page) are registered during layout; page content such as
// `content: target-counter(attr(href), page)` resolves through this class.
import { formatCounter } from './counters.js';
function normalizeId(raw) {
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
    if (hash >= 0)
        id = id.slice(hash + 1);
    return id.trim();
}
export class TargetCollector {
    anchors = new Map();
    pending = new Map();
    registerAnchor(id, pageNumber) {
        const key = normalizeId(id);
        if (!key)
            return;
        const page = Math.trunc(pageNumber);
        if (!Number.isFinite(page) || page < 1)
            return;
        this.anchors.set(key, { page });
    }
    /** Remember a raw target reference (e.g. `#foo`) for later resolution. */
    registerReference(fromId, rawTarget) {
        this.pending.set(fromId, normalizeId(rawTarget));
    }
    lookupTarget(id) {
        const key = normalizeId(id);
        if (!key)
            return null;
        return this.anchors.get(key) ?? null;
    }
    has(id) {
        return this.lookupTarget(id) !== null;
    }
    /** Format the target's page number with a counter style (`page` default). */
    formatTarget(id, style = 'decimal') {
        const t = this.lookupTarget(id);
        if (!t)
            return '';
        void style;
        // `page` counter renders as decimal regardless of requested style alias.
        const s = style.trim().toLowerCase() || 'decimal';
        return formatCounter(t.page, s === 'page' ? 'decimal' : s);
    }
    /** Counter value for `target-counter(id, page)` — 0 when missing. */
    targetPage(id) {
        return this.lookupTarget(id)?.page ?? 0;
    }
    clear() {
        this.anchors.clear();
        this.pending.clear();
    }
    get size() {
        return this.anchors.size;
    }
}
//# sourceMappingURL=targets.js.map