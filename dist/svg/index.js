// SVG — mirrors weasyprint/svg.py intrinsic sizing (subset).
// Parses width/height attributes with a viewBox fallback (default 300x150
// per CSS, like replaced elements) and builds embeddable data URLs.
export function svgIntrinsicSize(svgText) {
    if (!/<svg[\s>/]/i.test(svgText)) {
        return null;
    }
    const tag = /<svg\b[^>]*>/i.exec(svgText)?.[0] ?? svgText;
    const wMatch = /\bwidth\s*=\s*["']?\s*([\d.]+)/i.exec(tag);
    const hMatch = /\bheight\s*=\s*["']?\s*([\d.]+)/i.exec(tag);
    const vbMatch = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(tag);
    let vbW = NaN;
    let vbH = NaN;
    if (vbMatch) {
        const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
            vbW = parts[2];
            vbH = parts[3];
        }
    }
    const w = wMatch !== null ? parseFloat(wMatch[1]) : NaN;
    const h = hMatch !== null ? parseFloat(hMatch[1]) : NaN;
    const hasW = Number.isFinite(w) && w > 0;
    const hasH = Number.isFinite(h) && h > 0;
    const hasVb = Number.isFinite(vbW) && Number.isFinite(vbH) && vbW > 0 && vbH > 0;
    if (hasW && hasH) {
        return { w, h };
    }
    if (hasW && hasVb) {
        return { w, h: (w * vbH) / vbW };
    }
    if (hasH && hasVb) {
        return { w: (h * vbW) / vbH, h };
    }
    if (hasVb) {
        return { w: vbW, h: vbH };
    }
    if (hasW) {
        return { w, h: 150 };
    }
    if (hasH) {
        return { w: 300, h };
    }
    return { w: 300, h: 150 };
}
export function svgToDataUrl(svgText) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}
//# sourceMappingURL=index.js.map