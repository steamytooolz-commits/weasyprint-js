export type CounterStyleName = 'decimal' | 'decimal-leading-zero' | 'lower-roman' | 'upper-roman' | 'lower-alpha' | 'upper-alpha' | 'lower-latin' | 'upper-latin' | 'disc' | 'circle' | 'square' | 'none' | (string & {});
export declare const DISC_SYMBOL = "\u2022";
export declare const CIRCLE_SYMBOL = "\u25CB";
export declare const SQUARE_SYMBOL = "\u25AA";
export declare const KNOWN_COUNTER_STYLES: ReadonlySet<string>;
/** Format an integer counter value with the given counter style. */
export declare function formatCounter(value: number, style: string): string;
export interface CounterSpec {
    name: string;
    value: number;
}
/** Parse `counter-reset` / `counter-increment` value lists. */
export declare function parseCounterList(value: string, def: number): CounterSpec[] | null;
/**
 * Tracks CSS counters with element-scoped nesting.
 * `owner` is the element uid that created the scope level; exitElement()
 * pops levels owned by a leaving element so siblings don't leak counters.
 */
export declare class CounterScopes {
    private stacks;
    private owners;
    reset(name: string, value?: number, owner?: number | null): void;
    increment(name: string, value?: number, owner?: number | null): void;
    applyReset(value: string, owner?: number | null): boolean;
    applyIncrement(value: string, owner?: number | null): boolean;
    getValue(name: string): number | null;
    getStack(name: string): number[];
    /** Resolve `counter(name, style?)` — missing counters read as 0. */
    counter(name: string, style?: string): string;
    /** Resolve `counters(name, sep, style?)` joining every scope level. */
    counters(name: string, separator?: string, style?: string): string;
    /** Pop scope levels created by `owner` (call when leaving an element). */
    exitElement(owner: number | null): void;
    clear(): void;
}
//# sourceMappingURL=counters.d.ts.map