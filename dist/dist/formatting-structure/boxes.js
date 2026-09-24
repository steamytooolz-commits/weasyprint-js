// Box tree — mirrors weasyprint/formatting_structure/{boxes,build}.py
// parse5 DOM -> ElementRef list + Box tree (block/inline/text).
import { parse } from 'parse5';
import { computedStyle, computedPseudoStyle } from '../css/cascade.js';
import { computeValue } from '../css/computed-values.js';
import { CounterScopes } from '../css/counters.js';
import { resolveContent, parseQuotes } from '../css/content.js';
let uidCounter = 1;
const BLOCK_TAGS = new Set(['html', 'body', 'div', 'p', 'section', 'article', 'header',
    'footer', 'main', 'nav', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol',
    'li', 'pre', 'blockquote', 'figure', 'hr', 'table', 'thead', 'tbody', 'tr',
    'form', 'fieldset', 'address', 'dl', 'dd', 'dt', 'figcaption', 'details']);
export function buildTree(html) {
    uidCounter = 1;
    const doc = parse(html);
    const elements = [];
    const byUid = new Map();
    const body = findTag(doc, 'body') ?? findTag(doc, 'html') ?? doc;
    const root = buildBox(body, null, elements, byUid);
    return { elements, root, byUid };
}
function findTag(node, tag) {
    if (node.tagName === tag)
        return node;
    for (const c of node.childNodes ?? []) {
        const f = findTag(c, tag);
        if (f)
            return f;
    }
    return null;
}
function buildBox(node, parentUid, elements, byUid) {
    if (!node.tagName) {
        // Keep raw text (only normalize newlines); whitespace collapsing happens
        // per-element at layout time based on `white-space` (so <pre> survives).
        const text = (node.value ?? '').replace(/\r\n?/g, '\n');
        return { uid: 0, type: 'text', tag: '#text', text, children: [], style: {}, attrs: {} };
    }
    const uid = uidCounter++;
    const attrs = {};
    for (const a of node.attrs ?? [])
        attrs[a.name.toLowerCase()] = a.value;
    const classes = (attrs['class'] ?? '').split(/\s+/).filter(Boolean);
    const ref = {
        uid, tag: node.tagName.toLowerCase(), id: attrs['id'] ?? null,
        classes, attrs, parentUid,
        inlineStyle: attrs['style'],
    };
    elements.push(ref);
    byUid.set(uid, ref);
    let type = BLOCK_TAGS.has(ref.tag) ? 'block' : 'inline';
    if (ref.tag === 'table')
        type = 'table';
    if (ref.tag === 'tr')
        type = 'table-row';
    if (ref.tag === 'td' || ref.tag === 'th')
        type = 'table-cell';
    if (ref.tag === 'li')
        type = 'list-item';
    if (ref.tag === 'br') {
        return { uid, type: 'text', tag: 'br', text: '\n', children: [], style: {}, attrs };
    }
    // Void / replaced elements never have box children.
    if (ref.tag === 'img' || ref.tag === 'hr' || ref.tag === 'input' || ref.tag === 'meta' || ref.tag === 'link') {
        return { uid, type: ref.tag === 'img' ? 'inline' : type, tag: ref.tag, text: null, children: [], style: {}, attrs };
    }
    const children = [];
    for (const c of node.childNodes ?? []) {
        if (!c.tagName && !((c.value ?? '').trim()))
            continue;
        children.push(buildBox(c, uid, elements, byUid));
    }
    return { uid, type, tag: ref.tag, text: null, children, style: {}, attrs };
}
/** Attach computed styles to every box (mutates in place). */
export function attachStyles(root, elements, matched, pseudos) {
    const memo = new Map();
    const walk = (box, parentStyle) => {
        if (box.uid !== 0) {
            const specified = computedStyle(matched, elements, box.uid, memo);
            const computed = {};
            for (const [prop, value] of Object.entries(specified)) {
                const c = computeValue(prop, value, parentStyle);
                if (c !== '')
                    computed[prop] = c;
            }
            box.style = computed;
            if (pseudos) {
                box.pseudoBefore = computedPseudoStyle(pseudos, box.uid, 'before', computed);
                box.pseudoAfter = computedPseudoStyle(pseudos, box.uid, 'after', computed);
            }
            const d = (box.style['display'] ?? '').trim();
            if (d.startsWith('inline'))
                box.type = 'inline';
            else if (d === 'block' || d === 'list-item')
                box.type = d;
            else if (d === 'table')
                box.type = 'table';
            else if (d === 'table-row')
                box.type = 'table-row';
            else if (d === 'table-cell')
                box.type = 'table-cell';
        }
        for (const c of box.children) {
            if (c.uid === 0)
                c.style = box.style;
            walk(c, box.style);
        }
    };
    walk(root, {});
}
/** Void elements never get ::before/::after boxes. */
const NO_GENERATED = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'col', 'area', 'base', 'embed', 'source', 'track', 'wbr']);
/**
 * Counter assignment + ::before/::after generation (document order walk).
 * Mirrors the counter/content side of formatting_structure/build.py.
 */
export function resolveCountersAndGenerated(root) {
    const scopes = new CounterScopes();
    let quoteDepth = 0;
    const walk = (box) => {
        if (box.uid !== 0 && !NO_GENERATED.has(box.tag)) {
            const style = box.style;
            if (style['counter-reset'])
                scopes.applyReset(style['counter-reset'], box.uid);
            if (box.tag === 'li' && !mentionsCounter(style['counter-increment'], 'list-item')) {
                scopes.increment('list-item', 1);
            }
            if (style['counter-increment'])
                scopes.applyIncrement(style['counter-increment'], box.uid);
            if (box.tag === 'li') {
                box.listMarker = {
                    value: scopes.getValue('list-item') ?? 0,
                    type: style['list-style-type'] ?? 'disc',
                };
            }
            const quotes = parseQuotes(style['quotes']);
            for (const kind of ['before', 'after']) {
                const pseudo = kind === 'before' ? box.pseudoBefore : box.pseudoAfter;
                if (!pseudo)
                    continue;
                const content = pseudo['content'] ?? 'normal';
                const resolved = resolveContent(content, {
                    counters: scopes, attrs: box.attrs, quotes, quoteDepth,
                });
                if (resolved && resolved.text) {
                    quoteDepth = resolved.quoteDepth;
                    const gen = {
                        uid: 0, type: 'text', tag: kind === 'before' ? '::before' : '::after',
                        text: resolved.text, children: [], style: pseudo, attrs: {},
                    };
                    if (kind === 'before')
                        box.children.unshift(gen);
                    else
                        box.children.push(gen);
                }
                box.pseudoBefore = kind === 'before' ? null : box.pseudoBefore;
                box.pseudoAfter = kind === 'after' ? null : box.pseudoAfter;
            }
        }
        for (const c of box.children)
            walk(c);
        if (box.uid !== 0)
            scopes.exitElement(box.uid);
    };
    walk(root);
}
function mentionsCounter(value, name) {
    if (!value)
        return false;
    return value.toLowerCase().split(/\s+/).includes(name);
}
/** Remove display:none subtrees (and display:none generated boxes). */
export function pruneDisplayNone(root) {
    if (root.uid !== 0 && (root.style['display'] ?? '').trim() === 'none')
        return null;
    if (root.uid === 0 && (root.tag === '::before' || root.tag === '::after') &&
        (root.style['display'] ?? '').trim() === 'none')
        return null;
    root.children = root.children.map(pruneDisplayNone).filter((b) => b != null);
    return root;
}
//# sourceMappingURL=boxes.js.map