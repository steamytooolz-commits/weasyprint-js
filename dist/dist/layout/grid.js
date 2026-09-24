// Grid track sizing — simplified `grid-template-columns` resolution.
function splitTrackList(input) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === '(')
            depth++;
        if (ch === ')')
            depth = Math.max(0, depth - 1);
        if (/\s/.test(ch) && depth === 0) {
            if (cur.trim() !== '') {
                out.push(cur.trim());
                cur = '';
            }
        }
        else {
            cur += ch;
        }
    }
    if (cur.trim() !== '')
        out.push(cur.trim());
    return out;
}
function expandRepeats(spec) {
    let working = spec.trim();
    const repeatRe = /repeat\(\s*([^,()]+)\s*,\s*((?:[^()]*|\([^()]*\))*)\s*\)/i;
    for (let guard = 0; guard < 16; guard++) {
        const m = repeatRe.exec(working);
        if (!m)
            break;
        const countRaw = m[1].trim().toLowerCase();
        const inner = m[2].trim();
        const full = m[0];
        const n = parseInt(countRaw, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 64) {
            working = working.replace(full, new Array(n).fill(inner).join(' '));
        }
        else {
            working = working.replace(full, '__AUTOFILL__(' + inner + ')');
        }
    }
    return splitTrackList(working);
}
function parseFixedPx(token, containerPx) {
    const t = token.trim().toLowerCase();
    let m = /^(-?[0-9]*\.?[0-9]+)px$/.exec(t);
    if (m)
        return parseFloat(m[1]);
    m = /^(-?[0-9]*\.?[0-9]+)%$/.exec(t);
    if (m)
        return (parseFloat(m[1]) / 100) * containerPx;
    m = /^(-?[0-9]*\.?[0-9]+)(pt|pc|in|cm|mm|q)$/.exec(t);
    if (m) {
        const n = parseFloat(m[1]);
        const u = m[2];
        const f = {
            pt: 96 / 72, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 25.4 / 4,
        };
        return n * (f[u] ?? 1);
    }
    return null;
}
function parseFr(token) {
    const t = token.trim().toLowerCase();
    if (t === 'auto')
        return null;
    const m = /^(-?[0-9]*\.?[0-9]+)?fr$/.exec(t);
    if (!m)
        return null;
    if (m[1] == null || m[1] === '')
        return 1;
    const n = parseFloat(m[1]);
    return Number.isFinite(n) && n >= 0 ? n : null;
}
function isAutoToken(token) {
    const t = token.trim().toLowerCase();
    if (t === 'auto' || t === 'min-content' || t === 'max-content')
        return true;
    if (t.indexOf('minmax(') === 0 || t.indexOf('fit-content(') === 0)
        return true;
    return false;
}
function minmaxAsFr(token) {
    const t = token.trim().toLowerCase();
    const m = /^minmax\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/.exec(t);
    if (!m)
        return null;
    const maxFr = parseFr(m[2].trim());
    if (maxFr != null)
        return maxFr;
    return null;
}
export function layoutGridTracks(spec, containerPx, gap, count) {
    const container = Number.isFinite(containerPx) && containerPx > 0 ? containerPx : 0;
    const gapPx = Number.isFinite(gap) && gap > 0 ? gap : 0;
    const itemCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    const raw = (spec ?? '').trim().toLowerCase();
    if (!raw || raw === 'none') {
        if (itemCount <= 0)
            return [];
        const w0 = itemCount === 1 ? container
            : Math.max(0, (container - gapPx * (itemCount - 1)) / itemCount);
        return new Array(itemCount).fill(w0);
    }
    const autoFillRe = /repeat\(\s*(auto-fill|auto-fit)\s*,\s*(.+)\s*\)/i;
    const autoM = autoFillRe.exec(raw);
    if (autoM) {
        const inner = autoM[2].trim();
        let minPx = NaN;
        const mm = /^minmax\(\s*([^,]+)\s*,/.exec(inner);
        if (mm) {
            const p = parseFixedPx(mm[1].trim(), container);
            if (p != null && p > 0)
                minPx = p;
        }
        else {
            const p = parseFixedPx(inner, container);
            if (p != null && p > 0)
                minPx = p;
        }
        let fit = itemCount;
        if (Number.isFinite(minPx) && minPx > 0) {
            fit = Math.max(1, Math.floor((container + gapPx) / (minPx + gapPx)));
            if (itemCount > 0)
                fit = Math.min(fit, itemCount);
            if (!Number.isFinite(fit) || fit < 1)
                fit = 1;
        }
        else if (fit <= 0) {
            return [];
        }
        const w = fit === 1 ? container : Math.max(0, (container - gapPx * (fit - 1)) / fit);
        return new Array(fit).fill(w);
    }
    const tokens = expandRepeats(raw).filter((t) => t !== '');
    const defs = tokens.filter((t) => t.indexOf('__AUTOFILL__') !== 0);
    const defList = defs.length > 0 ? defs : tokens;
    if (defList.length === 0) {
        if (itemCount <= 0)
            return [];
        const w0 = itemCount === 1 ? container
            : Math.max(0, (container - gapPx * (itemCount - 1)) / itemCount);
        return new Array(itemCount).fill(w0);
    }
    const n = defList.length;
    const fixed = new Array(n).fill(null);
    const frs = new Array(n).fill(0);
    const isAuto = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
        const tok = defList[i];
        const fr = parseFr(tok);
        if (fr != null) {
            frs[i] = fr;
            continue;
        }
        const mmFr = minmaxAsFr(tok);
        if (mmFr != null) {
            frs[i] = mmFr;
            continue;
        }
        const fx = parseFixedPx(tok, container);
        if (fx != null) {
            fixed[i] = Math.max(0, fx);
            continue;
        }
        if (tok.indexOf('minmax(') === 0) {
            const m = /^minmax\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/.exec(tok);
            if (m) {
                const mx = parseFixedPx(m[2].trim(), container);
                if (mx != null) {
                    fixed[i] = Math.max(0, mx);
                    continue;
                }
            }
            isAuto[i] = true;
            continue;
        }
        isAuto[i] = true;
    }
    void isAutoToken;
    const gapTotal = gapPx * Math.max(0, n - 1);
    let fixedSum = 0;
    for (let i = 0; i < n; i++)
        if (fixed[i] != null)
            fixedSum += fixed[i];
    let free = container - gapTotal - fixedSum;
    if (free < 0)
        free = 0;
    let totalFr = 0;
    let autoCount = 0;
    for (let i = 0; i < n; i++) {
        totalFr += frs[i];
        if (isAuto[i])
            autoCount++;
    }
    const totalUnits = totalFr + autoCount;
    const out = new Array(n);
    if (totalUnits > 0) {
        const unit = free / totalUnits;
        for (let i = 0; i < n; i++) {
            if (fixed[i] != null)
                out[i] = fixed[i];
            else if (frs[i] > 0)
                out[i] = unit * frs[i];
            else
                out[i] = unit;
        }
    }
    else {
        for (let i = 0; i < n; i++)
            out[i] = fixed[i];
    }
    return out;
}
function parseLinePart(part) {
    const t = part.trim().toLowerCase();
    if (t === '' || t === 'auto')
        return { span: false, value: null };
    const sm = /^span\s+([0-9]+)$/.exec(t);
    if (sm) {
        const v = parseInt(sm[1], 10);
        return { span: true, value: Number.isFinite(v) && v >= 1 ? v : 1 };
    }
    const nn = parseInt(t, 10);
    if (Number.isFinite(nn))
        return { span: false, value: nn };
    return { span: false, value: null };
}
function resolveAxis(shorthand, startLong, endLong, defStart) {
    let start = null;
    let end = null;
    let startSpan = null;
    let endSpan = null;
    if (shorthand != null && shorthand.trim() !== '') {
        const parts = shorthand.split('/').map((p) => p.trim());
        if (parts.length === 1) {
            const p = parseLinePart(parts[0]);
            if (p.span)
                startSpan = p.value ?? 1;
            else if (p.value != null)
                start = p.value;
        }
        else {
            const a = parseLinePart(parts[0] ?? '');
            const b = parseLinePart(parts[1] ?? '');
            if (a.span)
                startSpan = a.value ?? 1;
            else if (a.value != null)
                start = a.value;
            if (b.span)
                endSpan = b.value ?? 1;
            else if (b.value != null)
                end = b.value;
        }
    }
    if (startLong != null && startLong.trim() !== '') {
        const p = parseLinePart(startLong);
        if (p.span) {
            start = null;
            startSpan = p.value ?? 1;
        }
        else {
            start = p.value;
            startSpan = null;
        }
    }
    if (endLong != null && endLong.trim() !== '') {
        const p = parseLinePart(endLong);
        if (p.span) {
            end = null;
            endSpan = p.value ?? 1;
        }
        else {
            end = p.value;
            endSpan = null;
        }
    }
    let s = start ?? defStart;
    let e = end;
    if (e == null) {
        if (endSpan != null)
            e = s + endSpan;
        else if (startSpan != null) {
            s = start ?? defStart;
            e = s + (startSpan ?? 1);
        }
        else
            e = s + 1;
    }
    else if (start == null && startSpan != null) {
        s = e - (startSpan ?? 1);
    }
    if (!Number.isFinite(s))
        s = defStart;
    if (!Number.isFinite(e))
        e = s + 1;
    let si = Math.max(1, Math.floor(s));
    let ei = Math.max(si + 1, Math.floor(e));
    if ((start ?? 0) < 0 || (end ?? 0) < 0) {
        if ((end ?? 0) < 0 && (start ?? 0) >= 0)
            ei = si + 1;
        else if ((start ?? 0) < 0 && (end ?? 0) >= 0)
            si = Math.max(1, ei - 1);
    }
    return { start: si, end: ei };
}
export function parseGridPlacement(style) {
    const get = (k) => style[k];
    let colShorthand = get('grid-column');
    let rowShorthand = get('grid-row');
    const area = get('grid-area');
    if (area != null && area.trim() !== '' && area.trim().toLowerCase() !== 'auto') {
        const parts = area.split('/').map((p) => p.trim());
        if (parts.length === 4) {
            rowShorthand = parts[0] + ' / ' + parts[2];
            colShorthand = parts[1] + ' / ' + parts[3];
        }
        else if (parts.length === 2) {
            rowShorthand = parts[0];
            colShorthand = parts[1];
        }
        else if (parts.length === 1) {
            rowShorthand = parts[0];
        }
        else if (parts.length === 3) {
            rowShorthand = parts[0] + ' / ' + parts[2];
            colShorthand = parts[1];
        }
    }
    const col = resolveAxis(colShorthand, get('grid-column-start'), get('grid-column-end'), 1);
    const row = resolveAxis(rowShorthand, get('grid-row-start'), get('grid-row-end'), 1);
    return { colStart: col.start, colEnd: col.end, rowStart: row.start, rowEnd: row.end };
}
//# sourceMappingURL=grid.js.map