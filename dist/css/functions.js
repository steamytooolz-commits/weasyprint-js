export function unquote(s) {
    const t = s.trim();
    if (t.length >= 2) {
        const f = t[0];
        const l = t[t.length - 1];
        if ((f === '"' && l === '"') || (f === "'" && l === "'")) {
            return t.slice(1, -1).replace(/\\(.)/g, '$1');
        }
    }
    return t;
}
export function splitArgs(inner) {
    const out = [];
    let depth = 0;
    let cur = '';
    let quote = null;
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (quote) {
            cur += ch;
            if (ch === quote && inner[i - 1] !== '\\')
                quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            cur += ch;
            continue;
        }
        if (ch === '(') {
            depth += 1;
            cur += ch;
            continue;
        }
        if (ch === ')') {
            depth -= 1;
            cur += ch;
            continue;
        }
        if (ch === ',' && depth === 0) {
            out.push(cur.trim());
            cur = '';
            continue;
        }
        cur += ch;
    }
    out.push(cur.trim());
    return out;
}
export function parseAttr(raw) {
    const m = /^\s*attr\(\s*(.*)\s*\)\s*$/is.exec(raw);
    if (!m)
        return null;
    const args = splitArgs(m[1]);
    if (args.length < 1 || args.length > 2)
        return null;
    const name = args[0].trim();
    if (!/^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(name))
        return null;
    const fallback = args.length === 2 ? unquote(args[1]) : null;
    return { name: name.toLowerCase(), fallback };
}
export function parseCounter(raw) {
    const m = /^\s*counter\(\s*(.*)\s*\)\s*$/is.exec(raw);
    if (!m)
        return null;
    const args = splitArgs(m[1]);
    if (args.length < 1 || args.length > 2)
        return null;
    const name = args[0].trim();
    if (!/^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(name))
        return null;
    const style = args.length === 2 ? unquote(args[1]).toLowerCase() || 'decimal' : 'decimal';
    return { name: name.toLowerCase(), style };
}
export function parseCounters(raw) {
    const m = /^\s*counters\(\s*(.*)\s*\)\s*$/is.exec(raw);
    if (!m)
        return null;
    const args = splitArgs(m[1]);
    if (args.length < 2 || args.length > 3)
        return null;
    const name = args[0].trim();
    if (!/^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(name))
        return null;
    const separator = unquote(args[1]);
    const style = args.length === 3 ? unquote(args[2]).toLowerCase() || 'decimal' : 'decimal';
    return { name: name.toLowerCase(), separator, style };
}
export function parseTargetCounter(raw) {
    const m = /^\s*target-counter\(\s*(.*)\s*\)\s*$/is.exec(raw);
    if (!m)
        return null;
    const args = splitArgs(m[1]);
    if (args.length < 2 || args.length > 3)
        return null;
    const style = args.length === 3 ? unquote(args[2]).toLowerCase() || 'decimal' : 'decimal';
    return { target: args[0].trim(), counter: unquote(args[1]).toLowerCase(), style };
}
/** Resolve an attr()/url target to a plain id or URL string. */
export function resolveTargetId(rawTarget, ctx) {
    const t = rawTarget.trim();
    const attr = parseAttr(t);
    if (attr) {
        const v = ctx.attrs?.[attr.name];
        if (v != null)
            return v;
        return attr.fallback ?? '';
    }
    const urlM = /^\s*url\(\s*(.*)\s*\)\s*$/is.exec(t);
    if (urlM)
        return unquote(urlM[1].trim());
    return unquote(t);
}
/** Split a `content` value into typed tokens. Returns null if invalid. */
export function tokenizeContent(value) {
    const v = value.trim();
    if (/^(normal|none)$/i.test(v))
        return [];
    const tokens = [];
    let i = 0;
    while (i < v.length) {
        while (i < v.length && /\s/.test(v[i]))
            i++;
        if (i >= v.length)
            break;
        const rest = v.slice(i);
        const kw = /^(no-open-quote|no-close-quote|open-quote|close-quote)(?![a-zA-Z-])/i.exec(rest);
        if (kw) {
            tokens.push({ kind: kw[1].toLowerCase() });
            i += kw[1].length;
            continue;
        }
        if (rest[0] === '"' || rest[0] === "'") {
            const q = rest[0];
            let j = 1;
            while (j < rest.length && rest[j] !== q) {
                if (rest[j] === '\\')
                    j++;
                j++;
            }
            if (j >= rest.length)
                return null;
            tokens.push({ kind: 'string', value: rest.slice(1, j).replace(/\\(.)/g, '$1') });
            i += j + 1;
            continue;
        }
        const fn = /^(target-counter|counters|counter|attr|url)\(/i.exec(rest);
        if (fn) {
            let depth = 0;
            let j = 0;
            let quote = null;
            for (; j < rest.length; j++) {
                const ch = rest[j];
                if (quote) {
                    if (ch === quote && rest[j - 1] !== '\\')
                        quote = null;
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    quote = ch;
                    continue;
                }
                if (ch === '(')
                    depth++;
                else if (ch === ')') {
                    depth--;
                    if (depth === 0)
                        break;
                }
            }
            if (depth !== 0)
                return null;
            const raw = rest.slice(0, j + 1);
            const name = fn[1].toLowerCase();
            if (name === 'url') {
                const m = /^\s*url\(\s*(.*)\s*\)\s*$/is.exec(raw);
                tokens.push({ kind: 'url', value: m ? unquote(m[1]) : '' });
            }
            else if (name === 'attr')
                tokens.push({ kind: 'attr', raw });
            else if (name === 'counter')
                tokens.push({ kind: 'counter', raw });
            else if (name === 'counters')
                tokens.push({ kind: 'counters', raw });
            else
                tokens.push({ kind: 'target-counter', raw });
            i += j + 1;
            continue;
        }
        return null;
    }
    return tokens;
}
/** Resolve one attr() against element attributes. */
export function resolveAttr(raw, attrs) {
    const parsed = parseAttr(raw);
    if (!parsed)
        return '';
    const v = attrs[parsed.name];
    if (v != null)
        return v;
    return parsed.fallback ?? '';
}
function quoteAt(quotes, depth, open) {
    const q = quotes && quotes.length >= 2 ? quotes : ['\u201C', '\u201D', '\u2018', '\u2019'];
    const pair = Math.floor(depth / 2) % Math.max(1, Math.floor(q.length / 2));
    return open ? (q[pair * 2] ?? '\u201C') : (q[pair * 2 + 1] ?? '\u201D');
}
/** Resolve a `content` declaration to display text. */
export function resolveContentList(style, context = {}) {
    const raw = (style['content'] ?? 'normal').trim();
    if (/^(normal|none)$/i.test(raw) || raw === '')
        return '';
    const tokens = tokenizeContent(raw);
    if (!tokens)
        return '';
    const attrs = context.attrs ?? {};
    let depth = context.quoteDepth ?? 0;
    let out = '';
    for (const t of tokens) {
        switch (t.kind) {
            case 'string':
                out += t.value;
                break;
            case 'url':
                out += t.value;
                break;
            case 'attr':
                out += resolveAttr(t.raw, attrs);
                break;
            case 'counter': {
                const p = parseCounter(t.raw);
                if (!p)
                    break;
                out += context.counters ? context.counters.counter(p.name, p.style) : '0';
                break;
            }
            case 'counters': {
                const p = parseCounters(t.raw);
                if (!p)
                    break;
                out += context.counters ? context.counters.counters(p.name, p.separator, p.style) : '';
                break;
            }
            case 'target-counter': {
                const p = parseTargetCounter(t.raw);
                if (!p)
                    break;
                out += context.targets ? context.targets.formatTarget(resolveTargetId(p.target, context), p.style) : '';
                break;
            }
            case 'open-quote':
                out += quoteAt(context.quotes, depth, true);
                depth += 1;
                break;
            case 'close-quote':
                depth = Math.max(0, depth - 1);
                out += quoteAt(context.quotes, depth, false);
                break;
            case 'no-open-quote':
                depth += 1;
                break;
            case 'no-close-quote':
                depth = Math.max(0, depth - 1);
                break;
        }
    }
    return out;
}
//# sourceMappingURL=functions.js.map