import type { PageRule } from '../css/types.js';
export interface PageBox {
    widthPx: number;
    heightPx: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
    contentWidth: number;
    contentHeight: number;
    /** @page margin-box styles (headers/footers), merged across rules. */
    marginBoxes: Record<string, Record<string, string>>;
}
export declare function pageBoxFromRules(rules: PageRule[]): PageBox;
//# sourceMappingURL=page.d.ts.map