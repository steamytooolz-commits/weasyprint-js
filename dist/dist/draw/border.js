// Draw: borders — mirrors weasyprint/draw/border.py (style resolution subset).
// Resolves per-side border geometry from cascaded CSS declarations so the
// pdf-lib painter can stroke each edge.
const BORDER_STYLES = new Set([
    'none',
    'hidden',
    'dotted',
    'dashed',
    'solid',
    'double',
    'groove',
    'ridge',
    'inset',
    'outset',
]);
function parseWidthPx(raw) {
    if (raw === undefined) {
        return 0;
    }
    const v = raw.trim().toLowerCase();
    if (v === '' || v === '0') {
        return 0;
    }
    if (v === 'thin') {
        return 1;
    }
    if (v === 'medium') {
        return 3;
    }
    if (v === 'thick') {
        return 5;
    }
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}
function shorthandParts(raw) {
    if (raw === undefined || raw.trim() === '') {
        return {};
    }
    const out = {};
    const colors = [];
    for (const token of raw.trim().split(/\s+/)) {
        const lower = token.toLowerCase();
        if (BORDER_STYLES.has(lower) && out.style === undefined) {
            out.style = lower;
        }
        else if (out.width === undefined &&
            (/^[\d.]+(px|pt|pc|in|cm|mm|q|em|rem|ex|ch)?$/i.test(lower) ||
                lower === 'thin' ||
                lower === 'medium' ||
                lower === 'thick' ||
                lower === '0')) {
            out.width = token;
        }
        else {
            colors.push(token);
        }
    }
    if (colors.length > 0) {
        out.color = colors.join(' ');
    }
    return out;
}
export function parseBorderSide(style, side) {
    const s = side.toLowerCase();
    const shorthand = shorthandParts(style['border']);
    const widthRaw = style[`border-${s}-width`] ?? style['border-width'] ?? shorthand.width ?? '0';
    const styleRaw = style[`border-${s}-style`] ?? style['border-style'] ?? shorthand.style ?? 'none';
    const colorRaw = style[`border-${s}-color`] ?? style['border-color'] ?? shorthand.color ?? 'black';
    return {
        widthPx: parseWidthPx(widthRaw),
        style: styleRaw.trim().toLowerCase() === '' ? 'none' : styleRaw.trim().toLowerCase(),
        color: colorRaw,
    };
}
export function borderWidths(style) {
    return {
        top: parseBorderSide(style, 'top').widthPx,
        right: parseBorderSide(style, 'right').widthPx,
        bottom: parseBorderSide(style, 'bottom').widthPx,
        left: parseBorderSide(style, 'left').widthPx,
    };
}
export function shouldDraw(side) {
    return side.style !== 'none' && side.style !== 'hidden' && side.widthPx > 0;
}
//# sourceMappingURL=border.js.map