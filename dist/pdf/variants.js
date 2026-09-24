// PDF variants — mirrors weasyprint/pdf/variants.py + weasyprint/__init__.py
// pdf_variant option. Maps each variant to its PDF version and conformance
// level (conformance B needs an sRGB OutputIntent; PDF/UA-1 needs a tagged
// structure tree — enforced by the caller when building the document).
export const VARIANTS = ['PDF/A-1b', 'PDF/A-2b', 'PDF/A-3b', 'PDF/UA-1', null];
export function variantInfo(variant, version) {
    if (variant === 'PDF/A-1b') {
        return { version: '1.4', conformance: 'B' };
    }
    if (variant === 'PDF/A-2b') {
        return { version: '1.7', conformance: 'B' };
    }
    if (variant === 'PDF/A-3b') {
        return { version: '1.7', conformance: 'B' };
    }
    if (variant === 'PDF/UA-1') {
        return { version: '1.7', conformance: 'UA-1' };
    }
    return { version: version ?? '1.7', conformance: null };
}
export function validateVariant(variant) {
    if (variant === null) {
        return null;
    }
    if (variant === 'PDF/A-1b' ||
        variant === 'PDF/A-2b' ||
        variant === 'PDF/A-3b' ||
        variant === 'PDF/UA-1') {
        return variant;
    }
    throw new Error(`Unknown PDF variant: ${variant}. Expected one of PDF/A-1b, PDF/A-2b, PDF/A-3b, PDF/UA-1 or null.`);
}
//# sourceMappingURL=variants.js.map