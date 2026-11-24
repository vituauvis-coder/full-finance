import { forwardRef, useEffect, useRef } from 'react';
import type { NotebookPage, NotebookPageSize, NotebookPaper, NotebookTemplate } from '../domain/notebookDoc';
import type { InkTool } from '../hooks/useInkCanvas';
import { useInkCanvas } from '../hooks/useInkCanvas';
import type { NotebookTool } from './NotebookToolbar';

type Props = {
    page: NotebookPage;
    index: number;
    paper: NotebookPaper;
    template: NotebookTemplate;
    pageSize: NotebookPageSize;
    mode: 'view' | 'edit';
    tool: NotebookTool;
    color: string;
    strokeWidth: number;
    onBodyChange: (html: string) => void;
    onInkChange: (dataUrl: string) => void;
    onPaste: (e: React.ClipboardEvent) => void;
};

export const NotebookPageSheet = forwardRef<HTMLElement, Props>(function NotebookPageSheet(
    {
        page,
        index,
        paper,
        template,
        pageSize,
        mode,
        tool,
        color,
        strokeWidth,
        onBodyChange,
        onInkChange,
        onPaste
    },
    ref
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inkTool: InkTool = tool === 'text' ? 'pen' : tool;
    const inkEnabled = mode === 'edit' && tool !== 'text';

    const ink = useInkCanvas(canvasRef, {
        inkDataUrl: page.inkDataUrl,
        color,
        strokeWidth,
        tool: inkTool,
        enabled: inkEnabled,
        onInkChange
    });

    const textEditable = mode === 'edit' && tool === 'text';
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!textEditable || !textRef.current) return;
        const html = page.bodyHtml || '<p><br></p>';
        if (textRef.current.innerHTML !== html) {
            textRef.current.innerHTML = html;
        }
    }, [textEditable, page.id, page.bodyHtml]);

    return (
        <article
            ref={ref}
            className={`estudos-notebook-page estudos-notebook-page--${paper} estudos-notebook-page--${template} estudos-notebook-page--size-${pageSize}`}
            data-page={index + 1}
            data-page-index={index}
            aria-label={`Página ${index + 1}`}
        >
            <span className="estudos-notebook-page__badge">{index + 1}</span>
            {textEditable ? (
                <div
                    ref={textRef}
                    className="estudos-notebook-page__text estudos-notebook-page__text--edit"
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    onInput={(e) => onBodyChange(e.currentTarget.innerHTML)}
                    onPaste={onPaste}
                />
            ) : (
                <div
                    className="estudos-notebook-page__text"
                    dangerouslySetInnerHTML={{ __html: page.bodyHtml || '<p class="estudos-caderno__empty">—</p>' }}
                />
            )}
            <canvas
                ref={canvasRef}
                className={`estudos-notebook-page__ink${inkEnabled ? ' estudos-notebook-page__ink--active' : ''}`}
                aria-hidden
                {...(inkEnabled ? ink : {})}
            />
        </article>
    );
});