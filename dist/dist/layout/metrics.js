// Layout text metrics — mirrors layout/preferred.py subset.
import { toPx } from '../css/units.js';
import { resolveFontFamily, fontWeightToNumber } from '../text/fonts.js';
import { matchFont, measureParsed } from '../text/ttf.js';
export function fontSizePx(style, parent = 16) {
    const raw = (style['font-size'] ?? 'medium').trim().toLowerCase();
    const named = {
        'xx-small': 9, 'x-small': 10, small: 13, medium: 16,
        large: 18, 'x-large': 24, 'xx-large': 32,
    };
    if (named[raw])
        return named[raw];
    const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q|em|rem|%)?$/.exec(raw);
    if (!m)
        return parent;
    const n = parseFloat(m[1]);
    const u = (m[2] ?? 'px').toLowerCase();
    if (u === 'em')
        return parent * n;
    if (u === 'rem')
        return 16 * n;
    if (u === '%')
        return (parent * n) / 100;
    return toPx(n, u, { fontSize: parent }) ?? parent;
}
export function lineHeightPx(style, fontPx) {
    const raw = (style['line-height'] ?? 'normal').trim();
    if (raw === 'normal')
        return fontPx * 1.2;
    if (/^[0-9.]+$/.test(raw))
        return fontPx * parseFloat(raw);
    const m = /^(-?[0-9.]+)(px|pt|em|rem|%)?$/.exec(raw);
    if (!m)
        return fontPx * 1.2;
    if (!m[2])
        return fontPx * parseFloat(m[1]);
    if (m[2] === '%')
        return (fontPx * parseFloat(m[1])) / 100;
    return toPx(parseFloat(m[1]), m[2], { fontSize: fontPx }) ?? fontPx * 1.2;
}
/** Glyph advance: registered @font-face TTF metrics win, else factor fallback. */
export function measureWidth(text, style) {
    const fs = fontSizePx(style);
    const fams = resolveFontFamily(style['font-family'] ?? 'sans-serif');
    const bold = fontWeightToNumber(style['font-weight'] ?? 'normal') >= 600;
    const weight = fontWeightToNumber(style['font-weight'] ?? 'normal');
    const italic = (style['font-style'] ?? 'normal') !== 'normal';
    const custom = matchFont(fams, weight, italic);
    let w;
    if (custom) {
        w = measureParsed(custom, text, fs);
        if (w <= 0)
            w = text.length * fs * 0.5;
    }
    else {
        const mono = fams.some((f) => f.includes('Courier') || f.includes('monospace'));
        if (mono) {
            w = text.length * fs * 0.6;
        }
        else {
            let sum = 0;
            for (const ch of text)
                sum += fs * charFactor(ch);
            w = sum;
        }
        w *= (bold ? 1.05 : 1) * (italic ? 1.01 : 1);
    }
    const ls = lengthPx(style['letter-spacing'] ?? 'normal', fs);
    if (ls)
        w += ls * Math.max(0, [...text].length);
    const ws = lengthPx(style['word-spacing'] ?? 'normal', fs);
    if (ws) {
        const gaps = text.trim() === '' ? 0 : text.trim().split(/\s+/).length - 1;
        if (gaps > 0)
            w += ws * gaps;
    }
    return w;
}
function charFactor(ch) {
    if (ch === ' ' || ch === '\t')
        return 0.28;
    if ('iljtfI|:;.,\'!()[]{}"'.includes(ch))
        return 0.3;
    if ('mwMW@%&'.includes(ch))
        return 0.82;
    if (ch >= 'A' && ch <= 'Z')
        return 0.68;
    if (ch >= '0' && ch <= '9')
        return 0.55;
    if (ch >= 'a' && ch <= 'z')
        return 0.5;
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x2500)
        return 0.7; // box drawing / CJK-ish wide fallback
    if (code > 0x7f)
        return 0.55;
    return 0.5;
}
function lengthPx(raw, fontPx) {
    const t = raw.trim().toLowerCase();
    if (t === '' || t === 'normal' || t === 'none')
        return 0;
    const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(t);
    if (!m)
        return 0;
    return toPx(parseFloat(m[1]), m[2] ?? 'px', { fontSize: fontPx }) ?? 0;
}
//# sourceMappingURL=metrics.js.map