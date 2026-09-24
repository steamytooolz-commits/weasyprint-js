export interface PropertyDef {
    initial: string;
    inherited: boolean;
}
export declare const PROPERTIES: Record<string, PropertyDef>;
export declare function isInherited(prop: string): boolean;
export declare function initialValue(prop: string): string;
//# sourceMappingURL=properties.d.ts.map