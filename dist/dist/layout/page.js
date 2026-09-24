// Layout: page model — mirrors weasyprint/layout/page.py (subset).
// @page size/orientation/margins -> content box in CSS px.
import { toPx } from '../css/units.js';
import { parsePageSize } from './page-sizes.js';
const SIZE_TABLE = {
    a5: [148, 210], a4: [210, 297], a3: [297, 420],
    letter: [215.9, 279.4], legal: [215.9, 355.6],
};
export function pageBoxFromRules(rules) {
    const decl = {};
    for (const r of rules) {
        if (r.name === 'default' && !r.pseudo)
            Object.assign(decl, r.declarations);
    }
    let wMm = 210, hMm = 297; // A4 default like WeasyPrint
    const rawSize = decl['size'] ?? 'a4';
    try {
        const parsed = parsePageSize(rawSize);
        if (Number.isFinite(parsed.wMm) && parsed.wMm > 0 &&
            Number.isFinite(parsed.hMm) && parsed.hMm > 0) {
            wMm = parsed.wMm;
            hMm = parsed.hMm;
        }
        else {
            throw new Error(`unparseable size: ${rawSize}`);
        }
    }
    catch {
        // Fall back to legacy SIZE_TABLE behavior.
        const size = rawSize.trim().toLowerCase();
        const parts = size.split(/\s+/);
        const named = SIZE_TABLE[parts[0]];
        if (named) {
            wMm = named[0];
            hMm = named[1];
        }
        if (parts.includes('landscape')) {
            const t = wMm;
            wMm = hMm;
            hMm = t;
        }
    }
    const wPx = (wMm * 96) / 25.4;
    const hPx = (hMm * 96) / 25.4;
    const margins = parseMarginShorthand(decl['margin'] ?? '10mm', decl);
    const marginBoxes = {};
    for (const r of rules) {
        if (r.name === 'default' && !r.pseudo && r.marginBoxes) {
            Object.assign(marginBoxes, r.marginBoxes);
        }
    }
    return {
        widthPx: wPx, heightPx: hPx,
        marginTop: margins[0], marginRight: margins[1],
        marginBottom: margins[2], marginLeft: margins[3],
        contentWidth: wPx - margins[3] - margins[1],
        contentHeight: hPx - margins[0] - margins[2],
        marginBoxes,
    };
}
function parseMarginShorthand(shorthand, decl) {
    const get = (side, fallback) => {
        const raw = decl[`margin-${side}`] ?? fallback;
        return lengthPx(raw, 0);
    };
    const parts = shorthand.split(/\s+/).filter(Boolean);
    let t, r, b, l;
    if (parts.length === 0) {
        t = r = b = l = '0';
    }
    else if (parts.length === 1) {
        t = r = b = l = parts[0];
    }
    else if (parts.length === 2) {
        [t, r] = parts;
        b = t;
        l = r;
    }
    else if (parts.length === 3) {
        [t, r, b] = parts;
        l = r;
    }
    else {
        [t, r, b, l] = parts;
    }
    return [get('top', t), get('right', r), get('bottom', b), get('left', l)];
}
function lengthPx(raw, fontSize) {
    const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q)?$/.exec(raw.trim());
    if (!m)
        return 0;
    const px = toPx(parseFloat(m[1]), m[2] ?? 'px', { fontSize });
    return px ?? 0;
}
//# sourceMappingURL=page.js.map