export interface TargetInfo {
    page: number;
}
export declare class TargetCollector {
    private anchors;
    private pending;
    registerAnchor(id: string, pageNumber: number): void;
    /** Remember a raw target reference (e.g. `#foo`) for later resolution. */
    registerReference(fromId: string, rawTarget: string): void;
    lookupTarget(id: string): TargetInfo | null;
    has(id: string): boolean;
    /** Format the target's page number with a counter style (`page` default). */
    formatTarget(id: string, style?: string): string;
    /** Counter value for `target-counter(id, page)` — 0 when missing. */
    targetPage(id: string): number;
    clear(): void;
    get size(): number;
}
//# sourceMappingURL=targets.d.ts.map