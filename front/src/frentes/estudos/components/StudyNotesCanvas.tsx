import { useCallback, useEffect, useRef, useState } from 'react';
import {
    newPageId,
    parseNotebookDoc,
    serializeNotebookDoc,
    type NotebookDoc
} from '../domain/notebookDoc';
import { SHEET_ZOOM_DEFAULT, clampSheetZoom } from '../domain/sheetZoom';
import type { NotebookTool } from './NotebookToolbar';
import { NotebookToolbar } from './NotebookToolbar';
import { NotebookPageSheet } from './NotebookPageSheet';
import { NotebookPagesRail } from './NotebookPagesRail';

type NotesMode = 'view' | 'edit';

type Props = {
    html: string;
    updatedAt?: string;
    onSave: (html: string) => void;
};

export function StudyNotesCanvas({ html, updatedAt, onSave }: Props) {
    const [mode, setMode] = useState<NotesMode>('view');
    const [savedDoc, setSavedDoc] = useState<NotebookDoc>(() => parseNotebookDoc(html));
    const [doc, setDoc] = useState<NotebookDoc>(() => parseNotebookDoc(html));
    const [tool, setTool] = useState<NotebookTool>('text');
    const [color, setColor] = useState('#1d1d1f');
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [sheetZoom, setSheetZoom] = useState(SHEET_ZOOM_DEFAULT);
    const stageRef = useRef<HTMLDivElement>(null);
    const screenRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<string, HTMLElement>>(new Map());
    const pendingScrollIndex = useRef<number | null>(null);

    useEffect(() => {
        const next = parseNotebookDoc(html);
        setSavedDoc(next);
        setDoc(next);
        setActivePageIndex(0);
    }, [html]);

    const savedRailLabel = updatedAt
        ? new Date(updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : null;

    const patchPage = useCallback((pageId: string, patch: Partial<NotebookDoc['pages'][number]>) => {
        setDoc((prev) => ({
            ...prev,
            pages: prev.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p))
        }));
    }, []);

    const scrollToPage = useCallback((index: number) => {
        const page = doc.pages[index];
        if (!page) return;
        const el = pageRefs.current.get(page.id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setActivePageIndex(index);
    }, [doc.pages]);

    const addPage = () => {
        setDoc((prev) => {
            pendingScrollIndex.current = prev.pages.length;
            return {
                ...prev,
                pages: [...prev.pages, { id: newPageId(), bodyHtml: '<p><br></p>' }]
            };
        });
    };

    useEffect(() => {
        if (pendingScrollIndex.current == null) return;
        const index = pendingScrollIndex.current;
        pendingScrollIndex.current = null;
        scrollToPage(index);
    }, [doc.pages.length, scrollToPage]);

    const save = () => {
        const serialized = serializeNotebookDoc(doc);
        setSavedDoc(doc);
        onSave(serialized);
        setMode('view');
    };

    const discard = () => {
        setDoc(savedDoc);
        setMode('view');
    };

    const insertImageFromFile = (file: File, pageId: string) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const src = String(reader.result ?? '');
            if (!src) return;
            const snippet = `<p><img src="${src}" alt="Imagem colada" class="estudos-notebook-img" /></p>`;
            setDoc((prev) => ({
                ...prev,
                pages: prev.pages.map((p) =>
                    p.id === pageId ? { ...p, bodyHtml: `${p.bodyHtml}${snippet}` } : p
                )
            }));
        };
        reader.readAsDataURL(file);
    };

    const handlePaste = (pageId: string) => (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) insertImageFromFile(file, pageId);
                return;
            }
        }
    };

    const patchDocStyle = (patch: Partial<Pick<NotebookDoc, 'paper' | 'template' | 'pageSize'>>) => {
        setDoc((prev) => ({ ...prev, ...patch }));
    };

    useEffect(() => {
        const screen = screenRef.current;
        const stage = stageRef.current;
        if (!screen || !stage) return;
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                const delta = -e.deltaY * 0.0025;
                setSheetZoom((z) => clampSheetZoom(z + delta));
                return;
            }
            const absX = Math.abs(e.deltaX);
            const absY = Math.abs(e.deltaY);
            if (absX > absY && absX > 4) {
                stage.scrollLeft += e.deltaX;
                e.preventDefault();
                return;
            }
            if (e.shiftKey && absY > 4) {
                stage.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        };
        screen.addEventListener('wheel', onWheel, { passive: false });
        return () => screen.removeEventListener('wheel', onWheel);
    }, []);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
                const top = visible[0];
                if (!top?.target) return;
                const idx = Number(top.target.getAttribute('data-page-index'));
                if (!Number.isNaN(idx)) setActivePageIndex(idx);
            },
            { root: stage, threshold: [0.45, 0.65, 0.85], rootMargin: '0px 12% 0px 12%' }
        );

        for (const el of pageRefs.current.values()) observer.observe(el);
        return () => observer.disconnect();
    }, [doc.pages, doc.pageSize, doc.paper, doc.template]);

    return (
        <section className="estudos-caderno" aria-label="Caderno de estudos">
            <NotebookToolbar
                mode={mode}
                tool={tool}
                color={color}
                strokeWidth={strokeWidth}
                paper={doc.paper}
                template={doc.template}
                pageSize={doc.pageSize}
                onModeChange={setMode}
                onToolChange={setTool}
                onColorChange={setColor}
                onStrokeWidthChange={setStrokeWidth}
                onPaperChange={(paper) => patchDocStyle({ paper })}
                onTemplateChange={(template) => patchDocStyle({ template })}
                onPageSizeChange={(pageSize) => patchDocStyle({ pageSize })}
                onAddPage={addPage}
                onSave={save}
                onDiscard={discard}
                sheetZoom={sheetZoom}
                onSheetZoomChange={(z) => setSheetZoom(clampSheetZoom(z))}
                onSheetZoomReset={() => setSheetZoom(SHEET_ZOOM_DEFAULT)}
            />

            <div className="estudos-caderno__desk">
                <NotebookPagesRail
                    pages={doc.pages}
                    activeIndex={activePageIndex}
                    savedLabel={savedRailLabel}
                    onSelect={scrollToPage}
                    onAddPage={addPage}
                />

                <div ref={screenRef} className="estudos-caderno__screen" aria-label="Área do caderno">
                    <div ref={stageRef} className="estudos-caderno__stage">
                        <div className="estudos-caderno__pages estudos-caderno__pages--horizontal">
                        {doc.pages.map((page, index) => (
                            <div
                                key={page.id}
                                ref={(node) => {
                                    if (node) pageRefs.current.set(page.id, node);
                                    else pageRefs.current.delete(page.id);
                                }}
                                className="estudos-notebook-slide"
                                data-page-index={index}
                            >
                                <div
                                    className="estudos-notebook-sheet-zoom"
                                    style={
                                        {
                                            zoom: sheetZoom,
                                            ['--estudos-sheet-zoom']: sheetZoom
                                        } as React.CSSProperties
                                    }
                                >
                                    <NotebookPageSheet
                                        page={page}
                                        index={index}
                                        paper={doc.paper}
                                        template={doc.template}
                                        pageSize={doc.pageSize}
                                        mode={mode}
                                        tool={tool}
                                        color={color}
                                        strokeWidth={strokeWidth}
                                        onBodyChange={(bodyHtml) => patchPage(page.id, { bodyHtml })}
                                        onInkChange={(inkDataUrl) => patchPage(page.id, { inkDataUrl })}
                                        onPaste={handlePaste(page.id)}
                                    />
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}