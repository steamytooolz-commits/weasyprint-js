// CSS cascade — mirrors weasyprint/css/__init__.py (preprocess + cascade).
import { parseStylesheet } from './tokens.js';
import { expandShorthands } from './tokens.js';
import { evaluateMedia } from './media-queries.js';
import { isInherited, initialValue } from './properties.js';
import { specificity, matches, buildSiblingCtx } from './specificity.js';
import { validateDeclaration } from './validation.js';
import { resolveVars } from './math.js';
import { computeValue } from './computed-values.js';
import { UA_STYLESHEET, UA_FORM_STYLESHEET, PH_STYLESHEET } from '../html.js';
export function buildCascade(elements, sheets, opts = {}) {
    const mediaType = opts.mediaType ?? 'print';
    const matched = new Map();
    const origins = new Map();
    for (const el of elements)
        matched.set(el.uid, new Map());
    const byUid = new Map(elements.map((e) => [e.uid, e]));
    const sibCtx = buildSiblingCtx(elements);
    const pseudos = { before: new Map(), after: new Map() };
    const pageRules = [];
    const fontFaces = [];
    const all = [
        { css: UA_STYLESHEET, origin: 'ua' },
        { css: UA_FORM_STYLESHEET, origin: 'ua' },
        { css: PH_STYLESHEET, origin: 'ua' },
        ...sheets,
    ];
    const applyRules = (rules, origin) => {
        for (const rule of rules) {
            if (rule.media && !evaluateMedia(rule.media, mediaType))
                continue;
            const decls = expandShorthands(rule.declarations);
            for (const sel of rule.selectors) {
                const spec = specificity(sel);
                // ::before/::after rules generate boxes: match the host element but
                // store declarations on the pseudo map instead of the element.
                const pseudoKind = trailingPseudo(sel);
                const hostSel = pseudoKind ? sel.slice(0, -pseudoKind.length).trim() || '*' : sel;
                for (const el of elements) {
                    if (!matches(el, hostSel, byUid, sibCtx))
                        continue;
                    if (pseudoKind === 'before' || pseudoKind === 'after') {
                        const map = pseudoKind === 'before' ? pseudos.before : pseudos.after;
                        let pm = map.get(el.uid);
                        if (!pm) {
                            pm = new Map();
                            map.set(el.uid, pm);
                        }
                        for (const d of decls) {
                            const validated = d.prop.startsWith('--')
                                ? d.value
                                : validateDeclaration(d.prop, d.value);
                            if (validated == null)
                                continue;
                            const prev = pm.get(d.prop);
                            const next = {
                                value: validated, important: d.important, specificity: spec, order: rule.order,
                            };
                            if (!prev || wins(next, origin, prev, origin))
                                pm.set(d.prop, next);
                        }
                        continue;
                    }
                    const map = matched.get(el.uid);
                    for (const d of decls) {
                        let value = d.value;
                        if (!d.prop.startsWith('--')) {
                            const validated = validateDeclaration(d.prop, d.value);
                            if (validated == null)
                                continue;
                            value = validated;
                        }
                        const prev = map.get(d.prop);
                        const next = {
                            value, important: d.important, specificity: spec, order: rule.order,
                        };
                        if (!prev || wins(next, origin, prev, origins.get(el.uid + '|' + d.prop) ?? 'ua')) {
                            map.set(d.prop, next);
                            origins.set(el.uid + '|' + d.prop, origin);
                        }
                    }
                }
            }
        }
    };
    for (const s of all) {
        if (s.media && !evaluateMedia(s.media, mediaType))
            continue;
        const sheet = parseStylesheet(s.css, s.media ?? null);
        const styles = sheet.rules.filter((r) => r.type === 'style');
        applyRules(styles, s.origin);
        for (const r of sheet.rules) {
            if (r.type !== 'at')
                continue;
            if (r.name === 'page') {
                pageRules.push(parsePageRule(r.prelude, r.block ?? ''));
            }
            else if (r.name === 'font-face') {
                fontFaces.push({ declarations: declMap(r.block ?? '') });
            }
            else if (r.name === 'media') {
                if (!evaluateMedia(r.prelude, mediaType))
                    continue;
                const inner = parseStylesheet(r.block ?? '');
                applyRules(inner.rules.filter((x) => x.type === 'style'), s.origin);
            }
        }
    }
    // Presentational hints: specificity [0,0,0], weakest author origin.
    // Mirror weasyprint/css/html5_ph.css + html presentational-hint mapping.
    if (opts.presentationalHints) {
        applyHints(elements, matched, origins);
    }
    // Inline `style=""`: specificity [1,0,0], wins over all author rules
    // except `!important` author declarations (per CSS cascade).
    applyInlineStyles(elements, matched, origins);
    return { matched, origins, pageRules, fontFaces, pseudos };
}
/** Trailing ::before/::after (or legacy :before/:after) of a selector. */
function trailingPseudo(sel) {
    const m = /::?(before|after)(\([^()]*\))?\s*$/i.exec(sel.trim());
    if (!m)
        return null;
    return m[1].toLowerCase();
}
const RANK = {
    ua: () => 0,
    user: (imp) => (imp ? 4 : 1),
    author: (imp) => (imp ? 3 : 2),
};
function wins(next, no, prev, po) {
    const rn = RANK[no](next.important);
    const rp = RANK[po](prev.important);
    if (rn !== rp)
        return rn > rp;
    const [a1, b1, c1] = next.specificity;
    const [a2, b2, c2] = prev.specificity;
    if (a1 !== a2)
        return a1 > a2;
    if (b1 !== b2)
        return b1 > b2;
    if (c1 !== c2)
        return c1 > c2;
    return next.order >= prev.order;
}
export function parsePageRule(prelude, block) {
    const m = /^([a-zA-Z][\w-]*)?\s*(?::(left|right|first|blank))?$/.exec(prelude.trim());
    const { declarations, marginBoxes } = splitPageBlock(block);
    return {
        name: (m?.[1] ?? '').toLowerCase() || 'default',
        pseudo: m?.[2]?.toLowerCase() ?? null,
        declarations,
        marginBoxes,
    };
}
/** Separate @page declarations from @top-center-style margin boxes. */
function splitPageBlock(block) {
    const marginBoxes = {};
    // Strip nested `@name { ... }` margin boxes (no nesting inside them).
    const cleaned = block.replace(/@([\w-]+)\s*\{([^{}]*)\}/g, (_m, name, body) => {
        marginBoxes[String(name).toLowerCase()] = declMap(body);
        return ' ';
    });
    return { declarations: declMap(cleaned), marginBoxes };
}
export function declMap(block) {
    const out = {};
    for (const part of splitDeclarations(block)) {
        const i = part.indexOf(':');
        if (i < 0)
            continue;
        const k = part.slice(0, i).trim().toLowerCase();
        const v = part.slice(i + 1).trim();
        if (k)
            out[k] = v;
    }
    return out;
}
/** Split a declaration block on top-level `;` (respect quotes/parens). */
function splitDeclarations(block) {
    const src = block.replace(/[{}]/g, '');
    const out = [];
    let depth = 0;
    let quote = null;
    let cur = '';
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (quote) {
            cur += ch;
            if (ch === quote && src[i - 1] !== '\\')
                quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            cur += ch;
            continue;
        }
        if (ch === '(')
            depth++;
        else if (ch === ')')
            depth = Math.max(0, depth - 1);
        if (ch === ';' && depth === 0) {
            out.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (cur.trim())
        out.push(cur);
    return out;
}
function setHint(matched, origins, el, prop, value) {
    const validated = validateDeclaration(prop, value);
    if (validated == null)
        return;
    const map = matched.get(el.uid);
    if (!map)
        return;
    const next = {
        value: validated, important: false, specificity: [0, 0, 0], order: -1,
    };
    const prev = map.get(prop);
    if (!prev || wins(next, 'author', prev, origins.get(el.uid + '|' + prop) ?? 'ua')) {
        map.set(prop, next);
        origins.set(el.uid + '|' + prop, 'author');
    }
}
/**
 * HTML presentational hints — mirrors the attribute→CSS mapping in
 * weasyprint/formatting_structure/build.py (subset). Only applied when
 * `presentationalHints: true` (same default-off behavior as Python).
 */
function applyHints(elements, matched, origins) {
    for (const el of elements) {
        const a = el.attrs;
        const tag = el.tag;
        if (a['bgcolor']) {
            const prop = tag === 'table' || tag === 'td' || tag === 'th' || tag === 'tr' || tag === 'body' ? 'background-color' : 'background-color';
            setHint(matched, origins, el, prop, a['bgcolor']);
        }
        if (tag === 'body' && a['text'])
            setHint(matched, origins, el, 'color', a['text']);
        if (a['color'] && tag === 'font')
            setHint(matched, origins, el, 'color', a['color']);
        if (a['face'] && tag === 'font')
            setHint(matched, origins, el, 'font-family', a['face']);
        if (a['size'] && tag === 'font') {
            const sizes = {
                '1': 'x-small', '2': 'small', '3': 'medium', '4': 'large',
                '5': 'x-large', '6': 'xx-large', '7': 'xxx-large',
            };
            const mapped = sizes[a['size'].trim().replace(/^[+-]/, '')];
            if (mapped)
                setHint(matched, origins, el, 'font-size', mapped);
        }
        if (a['align']) {
            const v = a['align'].trim().toLowerCase();
            if (['left', 'right', 'center', 'justify'].includes(v)) {
                if (tag === 'img' && (v === 'left' || v === 'right')) {
                    setHint(matched, origins, el, 'float', v);
                }
                else {
                    setHint(matched, origins, el, 'text-align', v === 'center' ? 'center' : v);
                }
            }
        }
        if (a['valign'] && (tag === 'td' || tag === 'th' || tag === 'tr')) {
            const v = a['valign'].trim().toLowerCase();
            if (['top', 'middle', 'bottom', 'baseline'].includes(v)) {
                setHint(matched, origins, el, 'vertical-align', v === 'middle' ? 'middle' : v);
            }
        }
        if (a['nowrap'] != null && (tag === 'td' || tag === 'th')) {
            setHint(matched, origins, el, 'white-space', 'nowrap');
        }
        const dimTags = new Set(['img', 'td', 'th', 'table', 'hr', 'pre', 'div', 'p']);
        if (a['width'] && dimTags.has(tag)) {
            const w = a['width'].trim();
            setHint(matched, origins, el, 'width', /^\d+$/.test(w) ? `${w}px` : w);
        }
        if (a['height'] && (tag === 'img' || tag === 'td' || tag === 'th')) {
            const h = a['height'].trim();
            setHint(matched, origins, el, 'height', /^\d+$/.test(h) ? `${h}px` : h);
        }
        if (a['border'] && (tag === 'table' || tag === 'img')) {
            const b = a['border'].trim();
            if (/^\d+$/.test(b))
                setHint(matched, origins, el, 'border-width', `${b}px`);
        }
        if (a['cellspacing'] && tag === 'table') {
            const cs = a['cellspacing'].trim();
            if (/^\d+$/.test(cs))
                setHint(matched, origins, el, 'border-spacing', `${cs}px`);
        }
        if (a['cellpadding'] && tag === 'table') {
            // cellpadding maps to padding on cells; approximate via border-spacing fallback.
            void a;
        }
        if (a['hspace'] && tag === 'img') {
            const n = parseFloat(a['hspace']);
            if (Number.isFinite(n)) {
                setHint(matched, origins, el, 'margin-left', `${n}px`);
                setHint(matched, origins, el, 'margin-right', `${n}px`);
            }
        }
        if (a['vspace'] && tag === 'img') {
            const n = parseFloat(a['vspace']);
            if (Number.isFinite(n)) {
                setHint(matched, origins, el, 'margin-top', `${n}px`);
                setHint(matched, origins, el, 'margin-bottom', `${n}px`);
            }
        }
        if (tag === 'ol' || tag === 'ul') {
            if (a['type']) {
                const t = a['type'].trim().toLowerCase();
                const map = {
                    '1': 'decimal', a: 'lower-alpha', A: 'upper-alpha',
                    i: 'lower-roman', I: 'upper-roman', disc: 'disc',
                    circle: 'circle', square: 'square', none: 'none',
                };
                if (map[t])
                    setHint(matched, origins, el, 'list-style-type', map[t]);
            }
        }
        if (tag === 'li' && a['type']) {
            const t = a['type'].trim().toLowerCase();
            if (['disc', 'circle', 'square', 'decimal', 'none'].includes(t)) {
                setHint(matched, origins, el, 'list-style-type', t);
            }
        }
    }
}
function applyInlineStyles(elements, matched, origins) {
    let order = 1_000_000;
    for (const el of elements) {
        const raw = el.inlineStyle;
        if (!raw || !raw.trim())
            continue;
        const map = matched.get(el.uid);
        if (!map)
            continue;
        for (const part of splitDeclarations(raw)) {
            const i = part.indexOf(':');
            if (i < 0)
                continue;
            const prop = part.slice(0, i).trim().toLowerCase();
            let value = part.slice(i + 1).trim();
            if (!prop || !value)
                continue;
            let important = false;
            const imp = /!important\s*$/i.exec(value);
            if (imp) {
                important = true;
                value = value.slice(0, imp.index).trim();
            }
            const decls = expandShorthands([{ prop, value, important }]);
            for (const d of decls) {
                let v = d.value;
                if (!d.prop.startsWith('--')) {
                    const validated = validateDeclaration(d.prop, d.value);
                    if (validated == null)
                        continue;
                    v = validated;
                }
                const next = {
                    value: v, important: d.important, specificity: [1, 0, 0], order: order++,
                };
                const prev = map.get(d.prop);
                if (!prev || wins(next, 'author', prev, origins.get(el.uid + '|' + d.prop) ?? 'ua')) {
                    map.set(d.prop, next);
                    origins.set(el.uid + '|' + d.prop, 'author');
                }
            }
        }
    }
}
const INHERIT_FALLBACK = ['color', 'font-family', 'font-size', 'font-style',
    'font-weight', 'line-height', 'text-align', 'white-space', 'direction', 'visibility'];
/** Resolve inheritance for one element. */
export function computedStyle(matched, elements, uid, memo = new Map()) {
    if (memo.has(uid))
        return memo.get(uid);
    const el = elements.find((e) => e.uid === uid);
    const out = {};
    for (const [prop, entry] of matched.get(uid) ?? new Map())
        out[prop] = entry.value;
    if (el.parentUid != null) {
        const parent = computedStyle(matched, elements, el.parentUid, memo);
        for (const prop of Object.keys(parent)) {
            // Custom properties always inherit; others per property table.
            if (!(prop in out) && (prop.startsWith('--') || isInherited(prop)))
                out[prop] = parent[prop];
        }
    }
    for (const prop of INHERIT_FALLBACK) {
        if (!(prop in out))
            out[prop] = initialValue(prop);
    }
    // Substitute var() now that inherited + own custom props are merged.
    // Unresolvable references drop the declaration (guaranteed-invalid).
    const vars = {};
    for (const [k, val] of Object.entries(out)) {
        if (k.startsWith('--'))
            vars[k] = val;
    }
    for (const [prop, val] of Object.entries(out)) {
        if (prop.startsWith('--') || !val.includes('var('))
            continue;
        const resolved = resolveVars(val, vars);
        if (resolved == null)
            delete out[prop];
        else
            out[prop] = resolved;
    }
    memo.set(uid, out);
    return out;
}
/**
 * Computed style for a ::before/::after pseudo-element: the originating
 * element's computed style as base, overlaid with the pseudo's own
 * declarations run through computeValue. Returns null when no rules apply.
 */
export function computedPseudoStyle(pseudos, uid, kind, elementStyle) {
    const map = kind === 'before' ? pseudos.before : pseudos.after;
    const decls = map.get(uid);
    if (!decls || decls.size === 0)
        return null;
    const out = { ...elementStyle };
    for (const [prop, entry] of decls) {
        const computed = computeValue(prop, entry.value, elementStyle);
        if (computed !== '')
            out[prop] = computed;
    }
    // Pseudo-element boxes are inline by default.
    if (!decls.has('display'))
        out['display'] = 'inline';
    return out;
}
//# sourceMappingURL=cascade.js.map