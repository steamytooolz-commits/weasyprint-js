/**
 * Tokenize a `content` value into items: quoted strings, balanced functions
 * (counter()/attr()/url()/…), and bare keywords. Splits on whitespace AND on
 * string/function boundaries (css-tree minifies `counter(x) " "` into one
 * run, which a whitespace splitter would fuse into a bogus token).
 */
function tokenize(value) {
    const out = [];
    let i = 0;
    const n = value.length;
    while (i < n) {
        while (i < n && /\s/.test(value[i]))
            i++;
        if (i >= n)
            break;
        const ch = value[i];
        if (ch === '"' || ch === "'") {
            const q = ch;
            let j = i + 1;
            while (j < n && value[j] !== q) {
                if (value[j] === '\\')
                    j++;
                j++;
            }
            out.push(value.slice(i, Math.min(n, j + 1)));
            i = Math.min(n, j + 1);
            continue;
        }
        // Bare word, possibly a function with balanced parens.
        let j = i;
        while (j < n && !/\s/.test(value[j]) && value[j] !== '"' && value[j] !== "'") {
            if (value[j] === '(') {
                let depth = 0;
                let k = j;
                while (k < n) {
                    if (value[k] === '"' || value[k] === "'") {
                        const q2 = value[k];
                        k++;
                        while (k < n && value[k] !== q2) {
                            if (value[k] === '\\')
                                k++;
                            k++;
                        }
                        k++;
                        continue;
                    }
                    if (value[k] === '(')
                        depth++;
                    else if (value[k] === ')') {
                        depth--;
                        if (depth === 0) {
                            k++;
                            break;
                        }
                    }
                    k++;
                }
                j = k;
                break;
            }
            j++;
        }
        if (j > i)
            out.push(value.slice(i, j));
        i = j;
    }
    return out;
}
/** Unescape a CSS string token (quotes included) → raw text. */
function unquoteString(tok) {
    const q = tok[0];
    if ((q !== '"' && q !== "'") || tok[tok.length - 1] !== q)
        return null;
    let out = '';
    const body = tok.slice(1, -1);
    for (let i = 0; i < body.length; i++) {
        if (body[i] === '\\' && i + 1 < body.length) {
            const nx = body[i + 1];
            if (nx === 'n') {
                out += '\n';
                i++;
                continue;
            }
            // Hex escape \A (up to 6 digits, optional trailing space).
            const hex = /^([0-9a-fA-F]{1,6})\s?/.exec(body.slice(i + 1));
            if (hex) {
                out += String.fromCodePoint(parseInt(hex[1], 16));
                i += hex[0].length;
                continue;
            }
            out += nx;
            i++;
            continue;
        }
        out += body[i];
    }
    return out;
}
/**
 * Resolve a computed `content` value to text. Returns null for
 * normal/none/unresolvable. `pageNumber`/`pageCount` resolve
 * counter(page)/counter(pages) (margin-box context); otherwise those
 * contribute ''.
 */
export function resolveContent(value, ctx, page) {
    const v = value.trim();
    if (!v || /^(normal|none)$/i.test(v))
        return null;
    let depth = ctx.quoteDepth;
    let out = '';
    let any = false;
    for (const tok of tokenize(v)) {
        const low = tok.toLowerCase();
        if (low === 'open-quote') {
            out += ctx.quotes[depth * 2] ?? '“';
            depth++;
            any = true;
            continue;
        }
        if (low === 'close-quote') {
            depth = Math.max(0, depth - 1);
            out += ctx.quotes[depth * 2 + 1] ?? '”';
            any = true;
            continue;
        }
        if (low === 'no-open-quote') {
            depth++;
            continue;
        }
        if (low === 'no-close-quote') {
            depth = Math.max(0, depth - 1);
            continue;
        }
        if (tok[0] === '"' || tok[0] === "'") {
            const s = unquoteString(tok);
            if (s == null)
                return null;
            out += s;
            any = true;
            continue;
        }
        let m = /^(counter|counters)\(\s*([^)]+)\)$/i.exec(tok);
        if (m) {
            const fn = m[1].toLowerCase();
            const args = m[2].split(',').map((s) => s.trim());
            const name = (args[0] ?? '').toLowerCase();
            if (name === 'page' || name === 'pages') {
                if (!page)
                    continue;
                const n = name === 'page' ? page.number : page.count;
                const style = (args[1] ?? 'decimal').replace(/["']/g, '');
                out += formatPageCounter(n, style);
                any = true;
                continue;
            }
            if (fn === 'counter') {
                out += ctx.counters.counter(name, (args[1] ?? 'decimal').replace(/["']/g, ''));
            }
            else {
                const sep = args[1] != null ? args[1].replace(/^["']|["']$/g, '') : '.';
                const style = (args[2] ?? 'decimal').replace(/["']/g, '');
                out += ctx.counters.counters(name, sep, style);
            }
            any = true;
            continue;
        }
        m = /^attr\(\s*([^)]+)\)$/i.exec(tok);
        if (m) {
            const args = m[1].split(',').map((s) => s.trim());
            const name = args[0].toLowerCase();
            const got = ctx.attrs[name];
            if (got != null) {
                out += got;
                any = true;
            }
            else if (args[1] != null) {
                const fb = unquoteString(args[1]);
                if (fb != null) {
                    out += fb;
                    any = true;
                }
            }
            continue;
        }
        // url(), target-counter(), target-text(), leader(): unsupported → skip.
        if (/^(url|target-counter|target-text|leader)\(/i.test(tok))
            continue;
        return null; // unknown token → invalid content
    }
    if (!any)
        return null;
    return { text: out, quoteDepth: depth };
}
function formatPageCounter(n, style) {
    const s = style.trim().toLowerCase() || 'decimal';
    if (s === 'decimal-leading-zero')
        return String(n).padStart(2, '0');
    if (s === 'lower-roman')
        return toRoman(n).toLowerCase();
    if (s === 'upper-roman')
        return toRoman(n);
    return String(n);
}
function toRoman(n) {
    const table = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
    ];
    let out = '';
    let rest = Math.max(1, Math.min(3999, n));
    for (const [val, sym] of table) {
        while (rest >= val) {
            out += sym;
            rest -= val;
        }
    }
    return out;
}
/** Parse the `quotes` property into open/close pairs. */
export function parseQuotes(value) {
    if (!value)
        return ['“', '”', '‘', '’'];
    const v = value.trim().toLowerCase();
    if (v === 'none')
        return [];
    if (v === 'auto')
        return ['“', '”', '‘', '’'];
    const parts = [];
    const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(value)) !== null) {
        parts.push(unquoteString(m[0]) ?? '');
    }
    return parts.length >= 2 ? parts : ['“', '”', '‘', '’'];
}
//# sourceMappingURL=content.js.map