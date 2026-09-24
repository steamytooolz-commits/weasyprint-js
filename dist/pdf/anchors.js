// PDF anchors / internal links — mirrors weasyprint/pdf/anchors.py
// plus the target side of weasyprint/pdf/links.py.
// This module stays pdf-lib agnostic: it only tracks anchor positions.
// The caller draws link annotations and supplies an
// onLink(id, rectPt, pageIndex) handler at draw time.
export class AnchorRegistry {
    byIdMap = new Map();
    add(a) {
        if (a.id.length > 0) {
            this.byIdMap.set(a.id, a);
        }
    }
    byId(id) {
        return this.byIdMap.get(id);
    }
    pageOf(id) {
        const found = this.byIdMap.get(id);
        return found === undefined ? null : found.pageIndex;
    }
}
export function collectAnchors(root) {
    const out = [];
    const walk = (node) => {
        const id = node.attrs !== undefined ? node.attrs['id'] : undefined;
        if (typeof id === 'string' && id.length > 0) {
            out.push(id);
        }
        const kids = node.children ?? [];
        for (const child of kids) {
            walk(child);
        }
    };
    walk(root);
    return out;
}
//# sourceMappingURL=anchors.js.map