// CSS property validation — mirrors weasyprint/css/validation/*.
// validateDeclaration(prop, value) returns the normalized value or null.
const NAMED_COLORS = new Set([
    'black', 'silver', 'gray', 'grey', 'white', 'maroon', 'red',
    'purple', 'fuchsia', 'magenta', 'green', 'lime', 'olive',
    'yellow', 'navy', 'blue', 'teal', 'aqua', 'cyan', 'orange',
    'aliceblue', 'antiquewhite', 'aquamarine', 'azure', 'beige',
    'bisque', 'blanchedalmond', 'blueviolet', 'brown', 'burlywood',
    'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
    'cornsilk', 'crimson', 'darkblue', 'darkcyan', 'darkgoldenrod',
    'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
    'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
    'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray',
    'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
    'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick',
    'floralwhite', 'forestgreen', 'gainsboro', 'ghostwhite', 'gold',
    'goldenrod', 'greenyellow', 'honeydew', 'hotpink', 'indianred',
    'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush',
    'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral',
    'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen',
    'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen',
    'lightskyblue', 'lightslategray', 'lightslategrey',
    'lightsteelblue', 'lightyellow', 'limegreen', 'linen', 'magenta',
    'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
    'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
    'mediumturquoise', 'mediumvioletred', 'midnightblue',
    'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'oldlace',
    'olivedrab', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
    'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff',
    'peru', 'pink', 'plum', 'powderblue', 'rosybrown', 'royalblue',
    'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
    'sienna', 'skyblue', 'slateblue', 'slategray', 'slategrey',
    'snow', 'springgreen', 'steelblue', 'tan', 'thistle', 'tomato',
    'turquoise', 'violet', 'wheat', 'whitesmoke', 'yellowgreen',
    'transparent', 'currentcolor',
]);
const LENGTH_UNITS = new Set([
    'px', 'pt', 'pc', 'in', 'cm', 'mm', 'q', 'em', 'rem', 'ex',
    'ch', 'cap', 'lh', 'vw', 'vh', 'vmin', 'vmax',
]);
const BORDER_STYLES = new Set([
    'none', 'hidden', 'dotted', 'dashed', 'solid', 'double',
    'groove', 'ridge', 'inset', 'outset',
]);
const BORDER_WIDTHS = new Set(['thin', 'medium', 'thick']);
const DISPLAY_VALUES = new Set([
    'block', 'inline', 'inline-block', 'inline-table', 'list-item',
    'none', 'table', 'table-cell', 'table-row', 'table-row-group',
    'table-header-group', 'table-footer-group', 'table-column',
    'table-column-group', 'table-caption', 'flex', 'inline-flex',
    'grid', 'inline-grid', 'flow-root', 'ruby', 'ruby-base',
    'ruby-text', 'contents', 'run-in',
]);
const TEXT_ALIGNS = new Set([
    'left', 'right', 'center', 'justify', 'start', 'end',
]);
const PAGE_BREAKS = new Set([
    'auto', 'always', 'avoid', 'left', 'right', 'page', 'column',
    'avoid-page', 'avoid-column',
]);
export function isValidColor(v) {
    const s = v.trim().toLowerCase();
    if (NAMED_COLORS.has(s))
        return true;
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s))
        return true;
    if (/^(rgb|rgba|hsl|hsla|hwb|lab|lch|color)\(/.test(s) && s.endsWith(')'))
        return true;
    return false;
}
export function normalizeColor(v) {
    const t = v.trim();
    if (!isValidColor(t))
        return null;
    if (/^#/.test(t))
        return t.toLowerCase();
    if (NAMED_COLORS.has(t.toLowerCase()))
        return t.toLowerCase();
    return t.replace(/\s+/g, ' ').trim();
}
export function isValidLength(v) {
    const t = v.trim().toLowerCase();
    if (/^[+-]?(\d*\.?\d+)$/.test(t))
        return parseFloat(t) === 0;
    const m = /^([+-]?(?:\d*\.?\d+))([a-z%]+)$/.exec(t);
    if (!m)
        return false;
    if (m[2] === '%')
        return false;
    return LENGTH_UNITS.has(m[2]);
}
export function isValidLengthOrPct(v) {
    const t = v.trim().toLowerCase();
    if (isValidLength(t))
        return true;
    return /^[+-]?(\d*\.?\d+)%$/.test(t);
}
export function normalizeLength(v) {
    const t = v.trim().toLowerCase();
    if (/^[+-]?(\d*\.?\d+)$/.test(t)) {
        if (parseFloat(t) !== 0)
            return null;
        return '0px';
    }
    const m = /^([+-]?(?:\d*\.?\d+))([a-z%]+)$/.exec(t);
    if (!m)
        return null;
    if (m[2] === '%' || !LENGTH_UNITS.has(m[2]))
        return null;
    return `${parseFloat(m[1])}${m[2]}`;
}
const FONT_WEIGHTS = new Set([
    'normal', 'bold', 'bolder', 'lighter',
    '100', '200', '300', '400', '500', '600', '700', '800', '900',
]);
const FONT_STYLES = new Set(['normal', 'italic', 'oblique']);
const FONT_SIZES = new Set([
    'xx-small', 'x-small', 'small', 'medium', 'large',
    'x-large', 'xx-large', 'xxx-large', 'smaller', 'larger',
]);
const GENERIC_FAMILIES = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
]);
const LIST_STYLES = new Set([
    'none', 'disc', 'circle', 'square', 'decimal', 'decimal-leading-zero',
    'lower-roman', 'upper-roman', 'lower-alpha', 'upper-alpha',
    'lower-latin', 'upper-latin', 'lower-greek', 'armenian', 'georgian',
]);
const LIST_POSITIONS = new Set(['inside', 'outside']);
function validFontFamily(v) {
    const t = v.trim();
    if (!t)
        return null;
    const parts = t.split(',');
    const norm = [];
    for (const p of parts) {
        const name = p.trim();
        if (!name)
            return null;
        if (/^(['"]).*\1$/.test(name)) {
            const inner = name.slice(1, -1).trim();
            if (!inner)
                return null;
            norm.push(`'${inner}'`);
        }
        else {
            const ok = name.split(/\s+/).every((w) => /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(w));
            if (!ok)
                return null;
            norm.push(GENERIC_FAMILIES.has(name.toLowerCase()) ? name.toLowerCase() : name);
        }
    }
    return norm.join(', ');
}
function validFontSize(v) {
    const t = v.trim().toLowerCase();
    if (FONT_SIZES.has(t))
        return t;
    if (isValidLengthOrPct(v.trim()))
        return v.trim().toLowerCase();
    return null;
}
function splitBorderShorthand(v) {
    const parts = v.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0 || parts.length > 3)
        return { w: null, s: null, c: null };
    let w = null;
    let s = null;
    let c = null;
    for (const p of parts) {
        const pl = p.toLowerCase();
        if (!w && (BORDER_WIDTHS.has(pl) || isValidLength(p)))
            w = BORDER_WIDTHS.has(pl) ? pl : normalizeLength(p);
        else if (!s && BORDER_STYLES.has(pl))
            s = pl;
        else if (!c && isValidColor(p))
            c = normalizeColor(p);
        else
            return { w: null, s: null, c: null };
    }
    return { w, s, c };
}
function validBorderSide(kind, v) {
    const t = v.trim();
    if (kind === 'width') {
        if (BORDER_WIDTHS.has(t.toLowerCase()))
            return t.toLowerCase();
        return normalizeLength(t);
    }
    if (kind === 'style')
        return BORDER_STYLES.has(t.toLowerCase()) ? t.toLowerCase() : null;
    return normalizeColor(t);
}
function validBackground(v) {
    const t = v.trim();
    if (/^(none|transparent)$/i.test(t))
        return t.toLowerCase();
    return normalizeColor(t) ?? (/^url\(/i.test(t) ? t.replace(/\s+/g, ' ') : null);
}
function validContent(v) {
    const t = v.trim();
    if (/^(normal|none)$/i.test(t))
        return t.toLowerCase();
    let i = 0;
    const n = t.length;
    let found = false;
    while (i < n) {
        while (i < n && /\s/.test(t[i]))
            i++;
        if (i >= n)
            break;
        const rest = t.slice(i);
        const kw = /^(open-quote|close-quote|no-open-quote|no-close-quote)\b/i.exec(rest);
        if (kw) {
            found = true;
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
            found = true;
            i += j + 1;
            continue;
        }
        const fn = /^(url|attr|counter|counters|target-counter)\(/i.exec(rest);
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
            found = true;
            i += j + 1;
            continue;
        }
        return null;
    }
    return found ? t.replace(/\s+/g, ' ').trim() : null;
}
function validQuotes(v) {
    const t = v.trim().toLowerCase();
    if (t === 'none' || t === 'auto')
        return t;
    const parts = [];
    let i = 0;
    const s = v.trim();
    while (i < s.length) {
        while (i < s.length && s[i] !== '"' && s[i] !== "'") {
            const c = s[i];
            if (c !== ' ' && c !== '\t' && c !== '\n')
                return null;
            i++;
        }
        if (i >= s.length)
            break;
        const q = s[i];
        let j = i + 1;
        while (j < s.length && s[j] !== q) {
            if (s[j] === '\\')
                j++;
            j++;
        }
        if (j >= s.length)
            return null;
        parts.push(s.slice(i, j + 1));
        i = j + 1;
    }
    if (parts.length === 0 || parts.length % 2 !== 0)
        return null;
    return parts.map((x) => x.trim()).join(' ');
}
function validListStyle(v) {
    const t = v.trim().toLowerCase();
    if (t === 'none')
        return 'none';
    const parts = v.trim().split(/\s+/);
    if (parts.length > 3)
        return null;
    let type = null;
    let pos = null;
    for (const p of parts) {
        const pl = p.toLowerCase();
        if (!type && LIST_STYLES.has(pl))
            type = pl;
        else if (!pos && LIST_POSITIONS.has(pl))
            pos = pl;
        else if (!/^url\(/i.test(p))
            return null;
    }
    if (!type && !pos)
        return null;
    return [type, pos].filter(Boolean).join(' ');
}
function validFlexGrid(v, prop) {
    const t = v.trim().toLowerCase();
    if (prop === 'flex-direction') {
        return ['row', 'row-reverse', 'column', 'column-reverse'].includes(t) ? t : null;
    }
    if (prop === 'flex-wrap') {
        return ['nowrap', 'wrap', 'wrap-reverse'].includes(t) ? t : null;
    }
    if (prop === 'flex-flow') {
        const parts = t.split(/\s+/);
        if (parts.length === 0 || parts.length > 2)
            return null;
        const ok = parts.every((v2) => ['row', 'row-reverse', 'column', 'column-reverse', 'nowrap', 'wrap', 'wrap-reverse'].includes(v2));
        return ok ? parts.join(' ') : null;
    }
    if (prop === 'flex-grow' || prop === 'flex-shrink') {
        return /^\d*\.?\d+$/.test(t) ? String(parseFloat(t)) : null;
    }
    if (prop === 'flex-basis') {
        if (t === 'auto' || t === 'content')
            return t;
        if (isValidLengthOrPct(v.trim()))
            return v.trim().toLowerCase();
        return null;
    }
    if (prop === 'flex') {
        if (t === 'none')
            return '0 0 auto';
        if (t === 'auto')
            return '1 1 auto';
        if (/^\d*\.?\d+$/.test(t))
            return `${parseFloat(t)} 1 0%`;
        if (isValidLengthOrPct(v.trim()))
            return `1 1 ${v.trim().toLowerCase()}`;
        return null;
    }
    if ((prop === 'order' || prop === 'z-index') && /^[-+]?\d+$/.test(t)) {
        return String(parseInt(t, 10));
    }
    if (prop === 'align-items') {
        const ok = ['stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end'];
        return ok.includes(t) ? t : null;
    }
    if (prop === 'justify-content') {
        const ok = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end', 'left', 'right'];
        return ok.includes(t) ? t : null;
    }
    if ((prop === 'grid-template-columns' || prop === 'grid-template-rows') && t.length > 0) {
        return v.trim().replace(/\s+/g, ' ');
    }
    return null;
}
function validBackgroundImage(v) {
    const t = v.trim();
    if (/^none$/i.test(t))
        return 'none';
    // Single url() layer (multiple layers unsupported — first wins downstream).
    const m = /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(t);
    if (m && m[2].trim())
        return `url(${m[2].trim()})`;
    // Gradients degrade: not painted, but valid so fallbacks still cascade.
    if (/^(linear|radial|repeating-linear|repeating-radial|conic)-gradient\(/i.test(t))
        return t;
    return null;
}
function validBoxShadow(v) {
    const t = v.trim();
    if (/^none$/i.test(t))
        return 'none';
    // offset-x offset-y [blur] [spread] [color] [inset] — single shadow only.
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 6)
        return null;
    let inset = false;
    const rest = [];
    for (const part of parts) {
        if (part.toLowerCase() === 'inset') {
            inset = true;
            continue;
        }
        rest.push(part);
    }
    if (rest.length < 2)
        return null;
    const lens = rest.filter((x) => isValidLength(x));
    if (lens.length < 2)
        return null;
    return (inset ? 'inset ' : '') + rest.join(' ');
}
function balanced(v) {
    let depth = 0;
    let quote = null;
    for (let i = 0; i < v.length; i++) {
        const ch = v[i];
        if (quote) {
            if (ch === quote && v[i - 1] !== '\\')
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
            if (depth < 0)
                return false;
        }
    }
    return depth === 0 && quote == null;
}
/** Validate + normalize one declaration. Returns normalized value or null. */
export function validateDeclaration(prop, value) {
    const p = prop.trim().toLowerCase();
    const v = value.trim();
    if (/^--/.test(p))
        return v;
    if (!p || !v || !SUPPORTED_PROPERTIES.has(p))
        return null;
    // var()/calc()/min()/max()/clamp() resolve at computed-value time against
    // inherited custom properties and layout context: accept provisionally.
    if (/var\(|calc\(|min\(|max\(|clamp\(/i.test(v)) {
        return balanced(v) ? v.replace(/\s+/g, ' ').trim() : null;
    }
    if (p === 'opacity') {
        const n = parseFloat(v);
        if (!Number.isFinite(n))
            return null;
        return String(Math.min(1, Math.max(0, n)));
    }
    if (p === 'box-shadow')
        return validBoxShadow(v);
    if (p === 'background-image')
        return validBackgroundImage(v);
    if (p === 'background-repeat') {
        const t = v.toLowerCase();
        return /^(repeat|repeat-x|repeat-y|no-repeat|space|round)(\s+(repeat|repeat-x|repeat-y|no-repeat|space|round))?$/.test(t)
            ? t.replace(/\s+/g, ' ') : null;
    }
    if (p === 'background-position' || p === 'background-size') {
        return v.length > 0 && v.length < 200 ? v.replace(/\s+/g, ' ') : null;
    }
    if (p === 'color' || p.endsWith('-color') || p === 'outline-color') {
        return normalizeColor(v);
    }
    if (p === 'display')
        return DISPLAY_VALUES.has(v.toLowerCase()) ? v.toLowerCase() : null;
    if (p === 'font-family')
        return validFontFamily(v);
    if (p === 'font-size')
        return validFontSize(v);
    if (p === 'font-weight') {
        const t = v.toLowerCase();
        return FONT_WEIGHTS.has(t) ? t : null;
    }
    if (p === 'font-style') {
        const t = v.toLowerCase();
        if (FONT_STYLES.has(t))
            return t;
        return /^oblique\s+[-+]?\d+deg$/i.test(v) ? v.toLowerCase() : null;
    }
    if (p === 'text-align')
        return TEXT_ALIGNS.has(v.toLowerCase()) ? v.toLowerCase() : null;
    if (p === 'page-break-before' || p === 'page-break-after') {
        return PAGE_BREAKS.has(v.toLowerCase()) ? v.toLowerCase() : null;
    }
    if (p === 'page-break-inside') {
        const t = v.toLowerCase();
        return t === 'auto' || t === 'avoid' ? t : null;
    }
    if (p === 'content')
        return validContent(v);
    if (p === 'quotes')
        return validQuotes(v);
    if (p === 'list-style-type')
        return LIST_STYLES.has(v.toLowerCase()) ? v.toLowerCase() : null;
    if (p === 'list-style-position')
        return LIST_POSITIONS.has(v.toLowerCase()) ? v.toLowerCase() : null;
    if (p === 'list-style')
        return validListStyle(v);
    if (/^(margin|padding)-(top|right|bottom|left)$/.test(p)) {
        if (v.toLowerCase() === 'auto' && p.startsWith('margin'))
            return 'auto';
        return isValidLengthOrPct(v) ? v.toLowerCase() : null;
    }
    if (/^(width|height|min-width|text-indent|letter-spacing)$/.test(p)) {
        const t = v.toLowerCase();
        if (['auto', 'normal', 'none'].includes(t))
            return t;
        return isValidLengthOrPct(v) ? v.toLowerCase() : null;
    }
    if (p === 'line-height') {
        const t = v.toLowerCase();
        if (t === 'normal')
            return 'normal';
        if (/^[+-]?\d*\.?\d+$/.test(t))
            return String(parseFloat(t));
        if (isValidLengthOrPct(v))
            return v.toLowerCase();
        return null;
    }
    const flexGrid = ['flex-direction', 'flex-wrap', 'flex-flow', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex', 'order', 'align-items', 'justify-content', 'z-index', 'grid-template-columns', 'grid-template-rows'];
    if (flexGrid.includes(p))
        return validFlexGrid(v, p);
    if (p === 'border' || p === 'border-top' || p === 'outline') {
        const parts = splitBorderShorthand(v);
        if (!parts.w && !parts.s && !parts.c)
            return null;
        return [parts.w, parts.s, parts.c].filter(Boolean).join(' ');
    }
    if (/^border-(top|right|bottom|left)-(width|style|color)$/.test(p)) {
        const kind = p.endsWith('width') ? 'width' : p.endsWith('style') ? 'style' : 'color';
        return validBorderSide(kind, v);
    }
    if (p === 'border-collapse') {
        const t = v.toLowerCase();
        return t === 'separate' || t === 'collapse' ? t : null;
    }
    if (p === 'border-spacing') {
        const parts = v.trim().split(/\s+/).filter(Boolean);
        if (parts.length < 1 || parts.length > 2)
            return null;
        if (!parts.every((x) => isValidLength(x)))
            return null;
        return parts.map((x) => x.toLowerCase()).join(' ');
    }
    if (p === 'background')
        return validBackground(v);
    return v.replace(/\s+/g, ' ').trim() || null;
}
export const SUPPORTED_PROPERTIES = new Set([
    'color', 'background', 'background-color', 'opacity',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'display', 'position', 'float', 'clear', 'visibility',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-width', 'border-style', 'border-color', 'outline',
    'border-top-width', 'border-top-style', 'border-top-color',
    'border-right-width', 'border-right-style', 'border-right-color',
    'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
    'border-left-width', 'border-left-style', 'border-left-color',
    'text-align', 'text-decoration', 'text-transform', 'text-indent',
    'letter-spacing', 'word-spacing', 'white-space', 'vertical-align',
    'page-break-before', 'page-break-after', 'page-break-inside',
    'break-before', 'break-after', 'break-inside',
    'flex', 'flex-direction', 'flex-wrap', 'flex-flow',
    'flex-grow', 'flex-shrink', 'flex-basis',
    'order', 'align-items', 'justify-content', 'z-index', 'gap',
    'grid-template-columns', 'grid-template-rows',
    'content', 'counter-reset', 'counter-increment',
    'list-style', 'list-style-type', 'list-style-position', 'quotes', 'border-collapse',
    'border-spacing', 'column-gap', 'row-gap', 'column-count', 'column-width', 'columns',
    'orphans', 'widows', 'box-sizing', 'overflow', 'overflow-x', 'overflow-y',
    'direction', 'unicode-bidi', 'caption-side', 'empty-cells', 'table-layout',
    'vertical-align', 'white-space', 'visibility', 'position', 'top', 'right',
    'bottom', 'left', 'opacity', 'background-color', 'background-image',
    'background-repeat', 'background-position', 'background-size', 'box-shadow',
]);
//# sourceMappingURL=validation.js.map