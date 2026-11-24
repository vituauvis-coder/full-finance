export type NotebookPaper = 'cream' | 'white' | 'slate' | 'night' | 'mint';

export type NotebookTemplate = 'lined' | 'grid' | 'dotted' | 'blank';

export type NotebookPageSize = 'a4' | 'letter' | 'wide';

export type NotebookPage = {
    id: string;
    bodyHtml: string;
    inkDataUrl?: string;
};

export type NotebookDoc = {
    version: 1;
    paper: NotebookPaper;
    template: NotebookTemplate;
    pageSize: NotebookPageSize;
    pages: NotebookPage[];
};

export function newPageId() {
    return `pg_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyNotebookDoc(): NotebookDoc {
    return {
        version: 1,
        paper: 'cream',
        template: 'lined',
        pageSize: 'a4',
        pages: [{ id: newPageId(), bodyHtml: '<p><br></p>' }]
    };
}

export function parseNotebookDoc(notesHtml: string): NotebookDoc {
    const raw = notesHtml?.trim() ?? '';
    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw) as NotebookDoc;
            if (parsed?.version === 1 && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
                return {
                    version: 1,
                    paper: parsed.paper ?? 'cream',
                    template: parsed.template ?? 'lined',
                    pageSize: parsed.pageSize ?? 'a4',
                    pages: parsed.pages.map((p) => ({
                        id: p.id || newPageId(),
                        bodyHtml: p.bodyHtml ?? '<p><br></p>',
                        inkDataUrl: p.inkDataUrl
                    }))
                };
            }
        } catch {
            /* legado HTML */
        }
    }
    if (!raw) return emptyNotebookDoc();
    return {
        version: 1,
        paper: 'cream',
        template: 'lined',
        pageSize: 'a4',
        pages: [{ id: newPageId(), bodyHtml: raw, inkDataUrl: undefined }]
    };
}

export function serializeNotebookDoc(doc: NotebookDoc): string {
    return JSON.stringify(doc);
}