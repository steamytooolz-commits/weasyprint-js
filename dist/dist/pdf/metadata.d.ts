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
export declare function applyMetadata(doc: {
    setTitle(title: string): void;
    setAuthor(author: string): void;
    setSubject(subject: string): void;
    setKeywords(keywords: string[]): void;
    setCreator(creator: string): void;
    setProducer(producer: string): void;
    setCreationDate(date: Date): void;
    setModificationDate(date: Date): void;
}, meta: DocMetadata): void;
//# sourceMappingURL=metadata.d.ts.map