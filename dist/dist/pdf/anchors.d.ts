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
export declare class AnchorRegistry {
    private readonly byIdMap;
    add(a: Anchor): void;
    byId(id: string): Anchor | undefined;
    pageOf(id: string): number | null;
}
export declare function collectAnchors(root: AnchorNode): string[];
//# sourceMappingURL=anchors.d.ts.map