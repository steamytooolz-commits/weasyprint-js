// Text constants — mirrors weasyprint/text/constants.py (subset).
// Unicode line-break / bidi helper data kept minimal; full UAX#14 lives in
// text/line-break.ts. This file holds space characters + Control tables.
export const SPACE_CHARACTERS = new Set([' ', '\t', '\n', '\r', '\f']);
export const PANGO_WHITESPACE = new Set([' ', '\t', '\n', '\r', '\f', '\u00a0']);
export const ZERO_WIDTH = new Set(['\u200b', '\u200c', '\u200d', '\ufeff']);
export function preserveSpaces(ws) {
    return ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces';
}
export function preserveLines(ws) {
    return ws === 'pre' || ws === 'pre-wrap' || ws === 'pre-line' || ws === 'break-spaces';
}
export function wrapAllowed(ws) {
    return ws === 'normal' || ws === 'pre-wrap' || ws === 'pre-line' || ws === 'break-spaces';
}
//# sourceMappingURL=constants.js.map