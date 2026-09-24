// Multi-column layout helpers — `column-count` / `column-width` / balancing.
function parseLengthToPx(raw, reference) {
    const t = raw.trim().toLowerCase();
    if (t === '')
        return null;
    let m = /^(-?[0-9]*\.?[0-9]+)%$/.exec(t);
    if (m) {
        const n = parseFloat(m[1]);
        if (!Number.isFinite(n))
            return null;
        return (n / 100) * reference;
    }
    m = /^(-?[0-9]*\.?[0-9]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(t);
    if (!m)
        return null;
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n))
        return null;
    const unit = (m[2] ?? 'px').toLowerCase();
    const fontSize = 16;
    switch (unit) {
        case 'px': return n;
        case 'pt': return (n * 96) / 72;
        case 'pc': return n * 16;
        case 'in': return n * 96;
        case 'cm': return (n * 96) / 2.54;
        case 'mm': return (n * 96) / 25.4;
        case 'q': return (n * 96) / 25.4 / 4;
        case 'em':
        case 'rem': return n * fontSize;
        default: return null;
    }
}
function parseGap(style, reference) {
    const raw = (style['column-gap'] ?? style['gap'] ?? 'normal').trim().toLowerCase();
    if (raw === '' || raw === 'normal')
        return 16;
    const px = parseLengthToPx(raw, reference);
    if (px == null || !Number.isFinite(px))
        return 16;
    return Math.max(0, px);
}
/** Resolve the used column count for a container of `width` px. */
export function columnCount(width, style) {
    const w = Number.isFinite(width) && width > 0 ? width : 0;
    const gap = parseGap(style, w);
    let countExplicit = null;
    let widthExplicit = null;
    const countRaw = (style['column-count'] ?? '').trim().toLowerCase();
    if (countRaw !== '' && countRaw !== 'auto') {
        const n = parseInt(countRaw, 10);
        if (Number.isFinite(n) && n >= 1)
            countExplicit = Math.floor(n);
    }
    const widthRaw = (style['column-width'] ?? '').trim().toLowerCase();
    if (widthRaw !== '' && widthRaw !== 'auto') {
        const px = parseLengthToPx(widthRaw, w);
        if (px != null && px > 0)
            widthExplicit = px;
    }
    if (countExplicit == null && widthExplicit == null) {
        const shorthand = (style['columns'] ?? '').trim().toLowerCase();
        if (shorthand !== '' && shorthand !== 'auto') {
            const parts = shorthand.split(/\s+/).filter(Boolean);
            for (const p of parts) {
                if (p === 'auto')
                    continue;
                if (/^[0-9]+$/.test(p)) {
                    const n = parseInt(p, 10);
                    if (Number.isFinite(n) && n >= 1 && countExplicit == null)
                        countExplicit = n;
                    continue;
                }
                const px = parseLengthToPx(p, w);
                if (px != null && px > 0 && widthExplicit == null)
                    widthExplicit = px;
            }
        }
    }
    if (countExplicit != null && widthExplicit != null) {
        const maxByWidth = Math.max(1, Math.floor((w + gap) / (widthExplicit + gap)));
        return Math.max(1, Math.min(countExplicit, maxByWidth));
    }
    if (countExplicit != null)
        return Math.max(1, countExplicit);
    if (widthExplicit != null) {
        if (w <= 0)
            return 1;
        return Math.max(1, Math.floor((w + gap) / (widthExplicit + gap)));
    }
    return 1;
}
/** Used column width for `count` equal columns with `gapPx` between them. */
export function columnWidth(count, containerPx, gapPx) {
    const c = Number.isFinite(count) ? Math.floor(count) : 1;
    const container = Number.isFinite(containerPx) ? containerPx : 0;
    const gap = Number.isFinite(gapPx) && gapPx > 0 ? gapPx : 0;
    if (c <= 0)
        return Math.max(0, container);
    if (c === 1)
        return Math.max(0, container);
    return Math.max(0, (container - gap * (c - 1)) / c);
}
/**
 * Balance items into `count` columns by height (order-preserving greedy:
 * each item goes to the currently shortest column).
 */
export function distributeToColumns(items, heights, count) {
    const c = Number.isFinite(count) ? Math.floor(count) : 1;
    if (c <= 0)
        return [items.slice()];
    const cols = Array.from({ length: c }, () => []);
    if (items.length === 0)
        return cols;
    const colHeights = new Array(c).fill(0);
    for (let i = 0; i < items.length; i++) {
        let best = 0;
        for (let k = 1; k < c; k++) {
            if (colHeights[k] < colHeights[best])
                best = k;
        }
        cols[best].push(items[i]);
        const h = heights[i];
        colHeights[best] += Number.isFinite(h) && h > 0 ? h : 0;
    }
    return cols;
}
//# sourceMappingURL=columns.js.map