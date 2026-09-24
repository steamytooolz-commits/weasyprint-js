export interface LengthCtx {
    fontPx?: number;
    rootPx?: number;
    /** Reference length for percentages (containing block, page, …). */
    refPx?: number | null;
}
/**
 * Evaluate a CSS length-ish value to px. Handles plain lengths, `var()`
 * (via `vars`), and nested calc()/min()/max()/clamp(). Percentages need
 * `ctx.refPx`, otherwise they fail (caller falls back).
 */
export declare function evaluateLengthToPx(raw: string, ctx?: LengthCtx, vars?: Record<string, string>): number | null;
export declare function evaluateClamp(raw: string, ctx?: LengthCtx, vars?: Record<string, string>): number | null;
/** Resolve var(--name, fallback) references using inherited custom props. */
export declare function resolveVars(value: string, vars: Record<string, string>): string | null;
/** True when the value needs layout context (var/math/%) to resolve. */
export declare function isComplexValue(value: string): boolean;
//# sourceMappingURL=math.d.ts.map