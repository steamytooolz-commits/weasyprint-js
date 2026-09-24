// PDF anchors / internal links — mirrors weasyprint/pdf/anchors.py
// plus the target side of weasyprint/pdf/links.py.
// This module stays pdf-lib agnostic: it only tracks anchor positions.
// The caller draws link annotations and supplies an
// onLink(id, rectPt, pageIndex) handler at draw time.

export interface Anchor {
  id: string;
  pageIndex: number;
  yPx: number;
}

export interface AnchorNode {
  uid: string;
  attrs: Record<string, string>;
  children: AnchorNode[];
}

export interface LinkRectPt {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type OnLinkHandler = (id: string, rectPt: LinkRectPt, pageIndex: number) => void;

export class AnchorRegistry {
  private readonly byIdMap = new Map<string, Anchor>();

  add(a: Anchor): void {
    if (a.id.length > 0) {
      this.byIdMap.set(a.id, a);
    }
  }

  byId(id: string): Anchor | undefined {
    return this.byIdMap.get(id);
  }

  pageOf(id: string): number | null {
    const found = this.byIdMap.get(id);
    return found === undefined ? null : found.pageIndex;
  }
}

export function collectAnchors(root: AnchorNode): string[] {
  const out: string[] = [];
  const walk = (node: AnchorNode): void => {
    const id = node.attrs !== undefined ? node.attrs['id'] : undefined;
    if (typeof id === 'string' && id.length > 0) {
      out.push(id);
    }
    const kids: AnchorNode[] = node.children ?? [];
    for (const child of kids) {
      walk(child);
    }
  };
  walk(root);
  return out;
}
