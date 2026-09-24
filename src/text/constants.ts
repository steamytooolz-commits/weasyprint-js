// Text constants — mirrors weasyprint/text/constants.py (subset).
// Unicode line-break / bidi helper data kept minimal; full UAX#14 lives in
// text/line-break.ts. This file holds space characters + Control tables.

export const SPACE_CHARACTERS = new Set([' ', '\t', '\n', '\r', '\f']);

export const PANGO_WHITESPACE = new Set([' ', '\t', '\n', '\r', '\f', '\u00a0']);

export const ZERO_WIDTH = new Set(['\u200b', '\u200c', '\u200d', '\ufeff']);

/** CSS `white-space` collapsing modes. */
export type WhiteSpace = 'normal' | 'pre' | 'nowrap' | 'pre-wrap' | 'break-spaces' | 'pre-line';

export function preserveSpaces(ws: WhiteSpace): boolean {
  return ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces';
}

export function preserveLines(ws: WhiteSpace): boolean {
  return ws === 'pre' || ws === 'pre-wrap' || ws === 'pre-line' || ws === 'break-spaces';
}

export function wrapAllowed(ws: WhiteSpace): boolean {
  return ws === 'normal' || ws === 'pre-wrap' || ws === 'pre-line' || ws === 'break-spaces';
}
