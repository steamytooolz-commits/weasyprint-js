// Selector specificity + matching — part of css/__init__.py port.
// Supports type/#id/.class/[attr], descendant/child/adjacent/sibling
// combinators and structural pseudo-classes (:nth-child, :not, …).
/** Build sibling order from document-order element refs. */
export function buildSiblingCtx(elements) {
    const byUid = new Map(elements.map((e) => [e.uid, e]));
    const childrenOf = new Map();
    for (const el of elements) {
        const list = childrenOf.get(el.parentUid) ?? [];
        list.push(el.uid);
        childrenOf.set(el.parentUid, list);
    }
    const indexOf = new Map();
    for (const list of childrenOf.values()) {
        list.forEach((uid, i) => indexOf.set(uid, i));
    }
    return { byUid, childrenOf, indexOf };
}
/** Compute (id, class/attr, element) specificity. */
export function specificity(selector) {
    let a = 0, b = 0, c = 0;
    // Pseudo-elements count as elements; evaluate before stripping.
    const pseudoEls = selector.match(/::[a-zA-Z-]+/g) ?? [];
    c += pseudoEls.length;
    let work = selector;
    // :not() contributes its most specific argument (not the :not itself).
    work = work.replace(/:not\(([^()]*)\)/g, (_m, inner) => {
        const parts = String(inner).split(',').map((s) => s.trim()).filter(Boolean);
        let best = [0, 0, 0];
        for (const p of parts) {
            const s = specificity(p);
            if (cmpSpec(s, best) > 0)
                best = s;
        }
        a += best[0];
        b += best[1];
        c += best[2];
        return ' ';
    });
    const noPseudo = work.replace(/::[a-zA-Z-]+/g, '');
    for (const p of noPseudo.split(/[\s>+~]+/)) {
        if (!p || p === '*')
            continue;
        a += (p.match(/#[A-Za-z0-9_-]+/g) ?? []).length;
        b += (p.match(/\.[A-Za-z0-9_-]+/g) ?? []).length;
        b += (p.match(/\[[^\]]+\]/g) ?? []).length;
        b += (p.match(/:[a-zA-Z-]+(\([^)]*\))?/g) ?? []).length;
        if (/^[A-Za-z][A-Za-z0-9-]*/.exec(p))
            c += 1;
    }
    return [a, b, c];
}
function cmpSpec(x, y) {
    if (x[0] !== y[0])
        return x[0] - y[0];
    if (x[1] !== y[1])
        return x[1] - y[1];
    return x[2] - y[2];
}
/** Split a selector into compounds with combinators (left→right). */
function tokenize(sel) {
    const parts = [];
    let depth = 0;
    let bracket = false;
    let cur = '';
    let comb = null;
    const flush = () => {
        const t = cur.trim();
        if (t)
            parts.push({ compound: t, combinator: comb });
        cur = '';
        comb = null;
    };
    for (let i = 0; i < sel.length; i++) {
        const ch = sel[i];
        if (ch === '(' && !bracket) {
            depth++;
            cur += ch;
            continue;
        }
        if (ch === ')' && !bracket) {
            depth = Math.max(0, depth - 1);
            cur += ch;
            continue;
        }
        if (ch === '[') {
            bracket = true;
            cur += ch;
            continue;
        }
        if (ch === ']') {
            bracket = false;
            cur += ch;
            continue;
        }
        if (depth === 0 && !bracket && (ch === '>' || ch === '+' || ch === '~')) {
            flush();
            comb = ch;
            continue;
        }
        if (depth === 0 && !bracket && /\s/.test(ch)) {
            if (cur.trim()) {
                flush();
                comb = ' ';
            }
            else if (comb == null) {
                comb = ' ';
            }
            continue;
        }
        cur += ch;
    }
    flush();
    if (parts.length > 0)
        parts[0].combinator = null;
    return parts;
}
/** Small selector matcher: type, #id, .class, [attr], pseudos, combinators. */
export function matches(el, selector, byUid, sibCtx) {
    // Pseudo-elements target generated boxes; the rule still matches the host.
    const sel = selector.replace(/::[a-zA-Z-]+(\([^)]*\))?/g, '').trim();
    if (!sel)
        return false;
    const parts = tokenize(sel);
    if (parts.length === 0)
        return false;
    const ctx = sibCtx ?? (byUid
        ? { byUid, childrenOf: new Map(), indexOf: new Map() }
        : null);
    let cur = el;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (!cur || !matchesCompound(cur, parts[i].compound, ctx))
            return false;
        if (i === 0)
            return true;
        const comb = parts[i].combinator ?? ' ';
        if (comb === '>') {
            cur = ctx?.byUid.get(cur.parentUid ?? -1);
            if (!cur)
                return false;
        }
        else if (comb === ' ') {
            if (!ctx)
                return false;
            let anc = ctx.byUid.get(cur.parentUid ?? -1);
            let found;
            while (anc) {
                if (matchesCompound(anc, parts[i - 1].compound, ctx)) {
                    found = anc;
                    break;
                }
                anc = ctx.byUid.get(anc.parentUid ?? -1);
            }
            if (!found)
                return false;
            cur = found;
            // Re-check this compound next iteration against `found`.
            continue;
        }
        else {
            // '+' / '~': previous siblings in document order.
            if (!ctx)
                return false;
            const sibs = ctx.childrenOf.get(cur.parentUid) ?? [];
            const idx = ctx.indexOf.get(cur.uid) ?? -1;
            if (comb === '+') {
                const prev = idx > 0 ? ctx.byUid.get(sibs[idx - 1]) : undefined;
                if (!prev || !matchesCompound(prev, parts[i - 1].compound, ctx))
                    return false;
                cur = prev;
                continue;
            }
            let found;
            for (let k = idx - 1; k >= 0; k--) {
                const cand = ctx.byUid.get(sibs[k]);
                if (cand && matchesCompound(cand, parts[i - 1].compound, ctx)) {
                    found = cand;
                    break;
                }
            }
            if (!found)
                return false;
            cur = found;
            continue;
        }
    }
    return true;
}
export function matchesCompound(el, compound, ctx) {
    let work = compound.trim();
    if (work === '' || work === '*')
        return true;
    // :not() — none of the inner selectors may match.
    const nots = [];
    work = work.replace(/:not\(([^()]*)\)/g, (_m, inner) => {
        nots.push(String(inner));
        return '';
    });
    for (const inner of nots) {
        const alts = inner.split(',').map((s) => s.trim()).filter(Boolean);
        for (const alt of alts) {
            if (matchesCompound(el, alt, ctx))
                return false;
        }
    }
    // Other pseudo-classes.
    const pseudos = [];
    work = work.replace(/:([a-zA-Z-]+)(\([^()]*\))?/g, (_m, name, args) => {
        pseudos.push(args ? `${name}${args}` : name);
        return '';
    });
    const tag = /^[A-Za-z][A-Za-z0-9-]*/.exec(work);
    if (tag && el.tag !== tag[0].toLowerCase())
        return false;
    for (const m of work.matchAll(/#([A-Za-z0-9_-]+)/g)) {
        if (el.id !== m[1])
            return false;
    }
    for (const m of work.matchAll(/\.([A-Za-z0-9_-]+)/g)) {
        if (!el.classes.includes(m[1]))
            return false;
    }
    const re = /\[([A-Za-z0-9_-]+)(?:([~|^$*]?=)["']?([^"'\]]*)["']?)?\]/g;
    for (const m of work.matchAll(re)) {
        const got = el.attrs[m[1].toLowerCase()];
        if (got == null)
            return false;
        const op = m[2];
        const want = m[3] ?? '';
        if (op === '=' && got !== want)
            return false;
        if (op === '~=' && !got.split(/\s+/).includes(want))
            return false;
        if (op === '|=' && !(got === want || got.startsWith(want + '-')))
            return false;
        if (op === '^=' && !got.startsWith(want))
            return false;
        if (op === '$=' && !got.endsWith(want))
            return false;
        if (op === '*=' && !got.includes(want))
            return false;
    }
    for (const pseudo of pseudos) {
        if (!evalPseudo(el, pseudo, ctx ?? null))
            return false;
    }
    return true;
}
function evalPseudo(el, pseudo, ctx) {
    const m = /^([a-zA-Z-]+)(\((.*)\))?$/.exec(pseudo);
    if (!m)
        return false;
    const name = m[1].toLowerCase();
    const args = (m[3] ?? '').trim();
    switch (name) {
        case 'root':
            return el.parentUid == null || el.tag === 'html';
        case 'empty': {
            // No element children (text unknown at match time — approximation).
            const kids = ctx?.childrenOf.get(el.uid) ?? null;
            if (kids != null)
                return kids.length === 0;
            return true;
        }
        case 'link':
        case 'any-link':
            return (el.tag === 'a' || el.tag === 'area') && el.attrs['href'] != null;
        case 'first-child':
            return sibIndex(el, ctx) === 0;
        case 'last-child': {
            const sibs = ctx?.childrenOf.get(el.parentUid) ?? null;
            if (!sibs)
                return true;
            return (ctx?.indexOf.get(el.uid) ?? 0) === sibs.length - 1;
        }
        case 'only-child': {
            const sibs = ctx?.childrenOf.get(el.parentUid) ?? null;
            if (!sibs)
                return true;
            return sibs.length === 1;
        }
        case 'first-of-type':
            return typeIndex(el, ctx) === 0;
        case 'last-of-type': {
            const total = typeCount(el, ctx);
            return typeIndex(el, ctx) === total - 1;
        }
        case 'only-of-type':
            return typeCount(el, ctx) === 1;
        case 'nth-child':
            return nth(sibIndex(el, ctx) + 1, args);
        case 'nth-last-child': {
            const sibs = ctx?.childrenOf.get(el.parentUid) ?? null;
            const total = sibs ? sibs.length : 1;
            const idx = ctx?.indexOf.get(el.uid) ?? 0;
            return nth(total - idx, args);
        }
        case 'nth-of-type':
            return nth(typeIndex(el, ctx) + 1, args);
        case 'nth-last-of-type': {
            const total = typeCount(el, ctx);
            return nth(total - typeIndex(el, ctx), args);
        }
        // Dynamic/user-action pseudos never match in print (like WeasyPrint).
        case 'hover':
        case 'active':
        case 'focus':
        case 'visited':
        case 'target':
            return false;
        default:
            // Unknown pseudo-classes fail closed (strict matching).
            return false;
    }
}
function sibIndex(el, ctx) {
    return ctx?.indexOf.get(el.uid) ?? 0;
}
function siblingsOf(el, ctx) {
    if (!ctx)
        return [el];
    const uids = ctx.childrenOf.get(el.parentUid) ?? [el.uid];
    return uids.map((u) => ctx.byUid.get(u)).filter((e) => e != null);
}
function typeIndex(el, ctx) {
    const sibs = siblingsOf(el, ctx).filter((s) => s.tag === el.tag);
    return sibs.findIndex((s) => s.uid === el.uid);
}
function typeCount(el, ctx) {
    return siblingsOf(el, ctx).filter((s) => s.tag === el.tag).length;
}
/** an+b matching for :nth-* (1-based). Supports odd/even/N. */
export function nth(pos, expr) {
    const e = expr.trim().toLowerCase();
    if (e === 'odd')
        return pos % 2 === 1;
    if (e === 'even')
        return pos % 2 === 0;
    if (/^[-+]?\d+$/.test(e))
        return pos === parseInt(e, 10);
    const m = /^([-+]?\d*)n\s*([+-]\s*\d+)?$/.exec(e.replace(/\s+/g, ''));
    if (!m)
        return false;
    const aStr = m[1];
    const a = aStr === '' || aStr === '+' ? 1 : aStr === '-' ? -1 : parseInt(aStr, 10);
    const b = m[2] ? parseInt(m[2].replace(/\s+/g, ''), 10) : 0;
    if (a === 0)
        return pos === b;
    const k = (pos - b) / a;
    return k >= 0 && Number.isInteger(k);
}
//# sourceMappingURL=specificity.js.map