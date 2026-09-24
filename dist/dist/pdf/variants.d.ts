export type PdfVariant = 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b' | 'PDF/UA-1' | null;
export declare const VARIANTS: PdfVariant[];
export declare function variantInfo(variant: PdfVariant, version: string | null): {
    version: string;
    conformance: string | null;
};
export declare function validateVariant(variant: string | null): PdfVariant;
//# sourceMappingURL=variants.d.ts.map