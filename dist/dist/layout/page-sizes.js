// Page sizes — mirrors weasyprint/layout/page.py size table (mm, portrait).
// All dimensions are [widthMm, heightMm] in portrait orientation.
export const ALL_PAGE_SIZES = {
    // ISO A series
    a0: [841, 1189],
    a1: [594, 841],
    a2: [420, 594],
    a3: [297, 420],
    a4: [210, 297],
    a5: [148, 210],
    a6: [105, 148],
    a7: [74, 105],
    a8: [52, 74],
    a9: [37, 52],
    a10: [26, 37],
    // ISO B series
    b0: [1000, 1414],
    b1: [707, 1000],
    b2: [500, 707],
    b3: [353, 500],
    b4: [250, 353],
    b5: [176, 250],
    b6: [125, 176],
    b7: [88, 125],
    b8: [62, 88],
    b9: [44, 62],
    b10: [31, 44],
    // ISO C series (envelopes)
    c0: [917, 1297],
    c1: [648, 917],
    c2: [458, 648],
    c3: [324, 458],
    c4: [229, 324],
    c5: [162, 229],
    c6: [114, 162],
    c7: [81, 114],
    c8: [57, 81],
    c9: [40, 57],
    c10: [28, 40],
    // North American
    letter: [215.9, 279.4],
    legal: [215.9, 355.6],
    tabloid: [279.4, 431.8],
    ledger: [431.8, 279.4],
    executive: [184.15, 266.7],
    folio: [215.9, 330.2],
    // JIS B series (prefixed to avoid clashing with ISO B)
    'jis-b0': [1030, 1456],
    'jis-b1': [728, 1030],
    'jis-b2': [515, 728],
    'jis-b3': [364, 515],
    'jis-b4': [257, 364],
    'jis-b5': [182, 257],
    'jis-b6': [128, 182],
    'jis-b7': [91, 128],
    'jis-b8': [64, 91],
    'jis-b9': [45, 64],
    'jis-b10': [32, 45],
    // Envelopes
    dl: [110, 220],
};
export const PAGE_SIZE_NAMES = Object.keys(ALL_PAGE_SIZES);
const LENGTH_TO_MM = {
    mm: 1,
    cm: 10,
    q: 0.25,
    in: 25.4,
    pt: 25.4 / 72,
    pc: 25.4 / 6,
    px: 25.4 / 96,
};
function parseLengthToMm(token) {
    const t = token.trim().toLowerCase();
    const m = /^(-?[0-9]*\.?[0-9]+)(mm|cm|q|in|pt|pc|px)?$/.exec(t);
    if (!m)
        return null;
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n))
        return null;
    const unit = (m[2] ?? 'px').toLowerCase();
    const factor = LENGTH_TO_MM[unit];
    if (factor == null)
        return null;
    return n * factor;
}
function normalizeName(name) {
    return name.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
}
/**
 * Parse a CSS `@page` `size` value.
 * Handles named sizes (`a4`, `letter`, `jis-b4`, `dl`, …),
 * explicit lengths (`8.5in 11in`, `210mm 297mm`) and
 * `landscape` / `portrait` keywords in any position.
 */
export function parsePageSize(sizeStr) {
    const raw = (sizeStr ?? '').trim().toLowerCase();
    if (!raw || raw === 'auto') {
        return { wMm: 210, hMm: 297, landscape: false };
    }
    const tokens = raw.split(/\s+/).filter(Boolean);
    let landscapeKw = false;
    let portraitKw = false;
    const rest = [];
    for (const tok of tokens) {
        if (tok === 'landscape')
            landscapeKw = true;
        else if (tok === 'portrait')
            portraitKw = true;
        else
            rest.push(tok);
    }
    let wMm = 210;
    let hMm = 297;
    if (rest.length === 0) {
        // Only an orientation keyword: default to A4, orient below.
    }
    else if (rest.length === 1) {
        const key = normalizeName(rest[0]);
        const entry = ALL_PAGE_SIZES[key] ?? ALL_PAGE_SIZES[rest[0]];
        if (entry) {
            wMm = entry[0];
            hMm = entry[1];
        }
        else {
            const mm = parseLengthToMm(rest[0]);
            if (mm != null && mm > 0) {
                wMm = mm;
                hMm = mm;
            }
        }
    }
    else if (rest.length === 2) {
        const a = parseLengthToMm(rest[0]);
        const b = parseLengthToMm(rest[1]);
        if (a != null && b != null && a > 0 && b > 0) {
            wMm = a;
            hMm = b;
        }
        else {
            // Tolerate `<name> <length>`-ish junk: try first token as a name.
            const key = normalizeName(rest[0]);
            const entry = ALL_PAGE_SIZES[key];
            if (entry) {
                wMm = entry[0];
                hMm = entry[1];
            }
        }
    }
    else {
        const a = parseLengthToMm(rest[0]);
        const b = parseLengthToMm(rest[1]);
        if (a != null && b != null && a > 0 && b > 0) {
            wMm = a;
            hMm = b;
        }
        else {
            const key = normalizeName(rest[0]);
            const entry = ALL_PAGE_SIZES[key];
            if (entry) {
                wMm = entry[0];
                hMm = entry[1];
            }
        }
    }
    if (landscapeKw && !portraitKw) {
        if (wMm < hMm) {
            const t = wMm;
            wMm = hMm;
            hMm = t;
        }
    }
    else if (portraitKw && !landscapeKw) {
        if (wMm > hMm) {
            const t = wMm;
            wMm = hMm;
            hMm = t;
        }
    }
    return { wMm, hMm, landscape: wMm > hMm };
}
//# sourceMappingURL=page-sizes.js.map