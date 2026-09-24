// Line breaking — mirrors weasyprint/text/line_break.py (subset).
// Greedy wrap on spaces + hyphenation hook; full UAX#14 in later phase.
import { wrapAllowed, preserveSpaces } from './constants.js';
export function wrapText(text, opts) {
    const ws = opts.whiteSpace ?? 'normal';
    if (!wrapAllowed(ws))
        return text.split('\n');
    const paras = text.split('\n');
    const out = [];
    for (const para of paras) {
        if (opts.maxWidth == null || opts.maxWidthFn == null) {
            out.push(...greedy(para, Number.POSITIVE_INFINITY, () => 0, opts));
        }
        else {
            out.push(...greedy(para, opts.maxWidth, opts.maxWidthFn, opts));
        }
    }
    return out;
}
function greedy(para, maxWidth, measure, opts) {
    const words = preserveSpaces(opts.whiteSpace)
        ? [para]
        : para.split(/(\s+)/).filter((w) => w.length > 0);
    const lines = [];
    let cur = '';
    const push = (w) => {
        if (!cur) {
            cur = w.trimStart();
            return;
        }
        const trial = cur + w;
        if (measure(trial) <= maxWidth || cur.trim() === '')
            cur = trial;
        else {
            lines.push(cur.trimEnd());
            cur = w.trimStart();
        }
    };
    for (const w of words) {
        if (/^\s+$/.test(w)) {
            push(' ');
            continue;
        }
        if (opts.hyphenate && opts.hyphenateWord && measure(cur + w) > maxWidth && w.length > 8) {
            const parts = opts.hyphenateWord(w);
            for (let i = 0; i < parts.length; i++) {
                const piece = i === 0 ? parts[i] : parts[i];
                const withHyphen = i < parts.length - 1 ? piece + '\u00ad' : piece;
                push(withHyphen);
            }
            continue;
        }
        push(w);
    }
    if (cur)
        lines.push(cur.trimEnd());
    return lines.length ? lines : [''];
}
//# sourceMappingURL=line-break.js.map