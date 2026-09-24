// PDF metadata — mirrors weasyprint/pdf/metadata.py (subset).
// Applies document info-dictionary entries through a pdf-lib compatible surface
// (PDFDocument satisfies this structurally).
export function applyMetadata(doc, meta) {
    if (meta.title !== undefined) {
        doc.setTitle(meta.title);
    }
    if (meta.author !== undefined) {
        doc.setAuthor(meta.author);
    }
    if (meta.subject !== undefined) {
        doc.setSubject(meta.subject);
    }
    if (meta.keywords !== undefined) {
        doc.setKeywords(Array.isArray(meta.keywords) ? meta.keywords : [meta.keywords]);
    }
    if (meta.creator !== undefined) {
        doc.setCreator(meta.creator);
    }
    if (meta.producer !== undefined) {
        doc.setProducer(meta.producer);
    }
    if (meta.created !== undefined) {
        doc.setCreationDate(meta.created);
    }
    if (meta.modified !== undefined) {
        doc.setModificationDate(meta.modified);
    }
}
//# sourceMappingURL=metadata.js.map