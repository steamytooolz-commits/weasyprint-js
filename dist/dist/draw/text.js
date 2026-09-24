// Draw: text helpers — mirrors weasyprint/draw/text.py + CSS text-transform
// and text-align: justify handling used by the pdf-lib text painter.
export function textTransform(text, transform) {
    const t = (transform ?? 'none').trim().toLowerCase();
    switch (t) {
        case 'uppercase':
            return text.toUpperCase();
        case 'lowercase':
            return text.toLowerCase();
        case 'capitalize':
            return text.replace(/(^|[\s])(\S)/g, (_m, pre, ch) => pre + ch.toUpperCase());
        case 'full-width':
            return text.replace(/[\u0020-\u007e]/g, (ch) => ch === ' ' ? '　' : String.fromCharCode(ch.charCodeAt(0) + 0xfee0));
        case 'none':
        case '':
        default:
            return text;
    }
}
export function letterSpacingWidth(text, spacingPx) {
    if (text.length === 0 || !Number.isFinite(spacingPx) || spacingPx === 0) {
        return 0;
    }
    return [...text].length * spacingPx;
}
export function justifyLine(words, targetWidth, measure) {
    if (words.length <= 1 || !Number.isFinite(targetWidth)) {
        return { words, extraPerGap: 0 };
    }
    let sum = 0;
    for (const w of words) {
        const wWidth = measure(w);
        sum += Number.isFinite(wWidth) ? wWidth : 0;
    }
    const gaps = words.length - 1;
    const extra = (targetWidth - sum) / gaps;
    return { words, extraPerGap: Number.isFinite(extra) && extra > 0 ? extra : 0 };
}
//# sourceMappingURL=text.js.map