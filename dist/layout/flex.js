// Flexbox row layout — simplified CSS flexbox main-size resolution.
function clampSize(v, minPx, maxPx) {
    const lo = Number.isFinite(minPx) ? Math.max(0, minPx) : 0;
    const hi = Number.isFinite(maxPx) ? maxPx : Infinity;
    const hiFixed = hi < lo ? lo : hi;
    if (v < lo)
        return lo;
    if (v > hiFixed)
        return hiFixed;
    return v;
}
function sanitise(n, fallback) {
    return Number.isFinite(n) ? n : fallback;
}
/**
 * Resolve final main sizes for a single flex row (no wrapping).
 * `containerWidth` is the inner main size of the flex container.
 * `gap` is the `gap`/`column-gap` between adjacent items.
 */
export function layoutFlexRow(items, containerWidth, gap = 0) {
    const n = items.length;
    if (n === 0)
        return [];
    const cw = Number.isFinite(containerWidth) ? containerWidth : 0;
    const g = Number.isFinite(gap) && gap > 0 ? gap : 0;
    const gapTotal = g * Math.max(0, n - 1);
    const basis = new Array(n);
    const grow = new Array(n);
    const shrink = new Array(n);
    const minPx = new Array(n);
    const maxPx = new Array(n);
    for (let i = 0; i < n; i++) {
        const it = items[i];
        const b = sanitise(it.basisPx, 0);
        const lo = sanitise(it.minPx, 0);
        let hi = sanitise(it.maxPx, Infinity);
        const loFixed = lo < 0 ? 0 : lo;
        if (hi < loFixed)
            hi = loFixed;
        basis[i] = b < 0 ? 0 : b;
        grow[i] = sanitise(it.grow, 0) < 0 ? 0 : sanitise(it.grow, 0);
        shrink[i] = sanitise(it.shrink, 1) < 0 ? 0 : sanitise(it.shrink, 1);
        minPx[i] = loFixed;
        maxPx[i] = hi;
    }
    // Hypothetical main sizes: basis clamped to min/max.
    const hyp = new Array(n);
    for (let i = 0; i < n; i++)
        hyp[i] = clampSize(basis[i], minPx[i], maxPx[i]);
    const sizes = hyp.slice();
    const sumHyp = hyp.reduce((a, b) => a + b, 0);
    const free = cw - gapTotal - sumHyp;
    if (free > 0) {
        // Grow: distribute free space by grow factor, freezing min/max violators.
        let unfrozen = new Set();
        for (let i = 0; i < n; i++) {
            if (grow[i] > 0 && sizes[i] < maxPx[i])
                unfrozen.add(i);
        }
        let remaining = free;
        // Items with no grow stay at hyp.
        for (let iter = 0; iter <= n && unfrozen.size > 0; iter++) {
            let totalGrow = 0;
            for (const i of unfrozen)
                totalGrow += grow[i];
            if (totalGrow <= 0)
                break;
            const proposals = new Map();
            for (const i of unfrozen) {
                proposals.set(i, sizes[i] + (remaining * grow[i]) / totalGrow);
            }
            const violating = [];
            for (const i of unfrozen) {
                const p = proposals.get(i) ?? sizes[i];
                if (p < minPx[i] - 1e-9 || p > maxPx[i] + 1e-9)
                    violating.push(i);
            }
            if (violating.length === 0) {
                for (const i of unfrozen)
                    sizes[i] = proposals.get(i) ?? sizes[i];
                break;
            }
            for (const i of violating) {
                const p = proposals.get(i) ?? sizes[i];
                const clamped = clampSize(p, minPx[i], maxPx[i]);
                remaining -= clamped - sizes[i];
                sizes[i] = clamped;
                unfrozen.delete(i);
            }
            if (violating.length === unfrozen.size + violating.length)
                break;
        }
    }
    else if (free < 0) {
        // Shrink: distribute deficit by shrink * hypothetical size.
        const deficit0 = -free;
        let unfrozen = new Set();
        for (let i = 0; i < n; i++) {
            if (shrink[i] > 0 && sizes[i] > minPx[i])
                unfrozen.add(i);
        }
        let remainingDeficit = deficit0;
        for (let iter = 0; iter <= n && unfrozen.size > 0; iter++) {
            let totalScaled = 0;
            for (const i of unfrozen)
                totalScaled += shrink[i] * hyp[i];
            if (totalScaled <= 0) {
                // Fall back to equal shrink among unfrozen.
                totalScaled = unfrozen.size;
                const proposals = new Map();
                for (const i of unfrozen) {
                    proposals.set(i, sizes[i] - remainingDeficit / totalScaled);
                }
                const violating = [...unfrozen].filter((i) => {
                    const p = proposals.get(i) ?? sizes[i];
                    return p < minPx[i] - 1e-9 || p > maxPx[i] + 1e-9;
                });
                if (violating.length === 0) {
                    for (const i of unfrozen)
                        sizes[i] = proposals.get(i) ?? sizes[i];
                    break;
                }
                for (const i of violating) {
                    const p = proposals.get(i) ?? sizes[i];
                    const clamped = clampSize(p, minPx[i], maxPx[i]);
                    remainingDeficit -= sizes[i] - clamped;
                    sizes[i] = clamped;
                    unfrozen.delete(i);
                }
                continue;
            }
            const proposals = new Map();
            for (const i of unfrozen) {
                const share = (remainingDeficit * shrink[i] * hyp[i]) / totalScaled;
                proposals.set(i, sizes[i] - share);
            }
            const violating = [];
            for (const i of unfrozen) {
                const p = proposals.get(i) ?? sizes[i];
                if (p < minPx[i] - 1e-9 || p > maxPx[i] + 1e-9)
                    violating.push(i);
            }
            if (violating.length === 0) {
                for (const i of unfrozen)
                    sizes[i] = proposals.get(i) ?? sizes[i];
                break;
            }
            for (const i of violating) {
                const p = proposals.get(i) ?? sizes[i];
                const clamped = clampSize(p, minPx[i], maxPx[i]);
                remainingDeficit -= sizes[i] - clamped;
                sizes[i] = clamped;
                unfrozen.delete(i);
            }
        }
    }
    for (let i = 0; i < n; i++) {
        if (!Number.isFinite(sizes[i]))
            sizes[i] = hyp[i];
        sizes[i] = clampSize(sizes[i], minPx[i], maxPx[i]);
    }
    return sizes;
}
//# sourceMappingURL=flex.js.map