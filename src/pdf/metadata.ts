// PDF metadata — mirrors weasyprint/pdf/metadata.py (subset).
// Applies document info-dictionary entries through a pdf-lib compatible surface
// (PDFDocument satisfies this structurally).

export interface DocMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string | string[];
  creator?: string;
  producer?: string;
  created?: Date;
  modified?: Date;
}

export function applyMetadata(
  doc: {
    setTitle(title: string): void;
    setAuthor(author: string): void;
    setSubject(subject: string): void;
    setKeywords(keywords: string[]): void;
    setCreator(creator: string): void;
    setProducer(producer: string): void;
    setCreationDate(date: Date): void;
    setModificationDate(date: Date): void;
  },
  meta: DocMetadata,
): void {
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
