// CSS units — mirrors weasyprint/css/units.py
// Default DPI: CSS px are 1/96in. WeasyPrint uses 0.75 px per pt internally;
// PDF points are 1/72in. Helpers convert everything to CSS px, then to PDF pt.
export const DEFAULT_DPI = 96;
export function pxToPt(px) {
    return (px * 72) / 96;
}
export function ptToPx(pt) {
    return (pt * 96) / 72;
}
export function mmToPx(mm) {
    return (mm * 96) / 25.4;
}
export function cmToPx(cm) {
    return (cm * 96) / 2.54;
}
export function inchToPxinch(inch) {
    return inch * 96;
}
const ABSOLUTE = {
    px: 1,
    pt: 96 / 72,
    pc: 16,
    in: 96,
    cm: 96 / 2.54,
    mm: 96 / 25.4,
    q: 96 / 2.54 / 40,
};
export function toPx(value, unit, opts = {}) {
    if (unit == null)
        return value;
    const u = unit.toLowerCase();
    if (u in ABSOLUTE)
        return value * ABSOLUTE[u];
    if (u === 'em' || u === 'rem' || u === 'ex' || u === 'ch' || u === 'cap') {
        const base = u === 'rem' ? (opts.rootFontSize ?? 16) : (opts.fontSize ?? 16);
        if (u === 'em' || u === 'rem')
            return value * base;
        return value * base * 0.5; // approx ex/ch/cap
    }
    if (u === '%')
        return null; // handled by caller (percent of containing block)
    return null; // unknown / viewport units resolved in layout
}
export function parseLength(text, opts) {
    const m = /^(-?[0-9]*\.?[0-9]+)([a-zA-Z%]*)$/.exec(text.trim());
    if (!m)
        return null;
    return { value: parseFloat(m[1]), unit: m[2] || null };
}
//# sourceMappingURL=units.js.map