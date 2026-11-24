import type { CSSProperties } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { NotebookPageSize, NotebookPaper, NotebookTemplate } from '../domain/notebookDoc';
import { SHEET_ZOOM_STEP, sheetZoomPercent } from '../domain/sheetZoom';
import type { InkTool } from '../hooks/useInkCanvas';

export type TextTool = 'text';

export type NotebookTool = TextTool | InkTool;

const COLORS = ['#1d1d1f', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed'] as const;

type Props = {
    mode: 'view' | 'edit';
    tool: NotebookTool;
    color: string;
    strokeWidth: number;
    paper: NotebookPaper;
    template: NotebookTemplate;
    pageSize: NotebookPageSize;
    onModeChange: (mode: 'view' | 'edit') => void;
    onToolChange: (tool: NotebookTool) => void;
    onColorChange: (color: string) => void;
    onStrokeWidthChange: (w: number) => void;
    onPaperChange: (paper: NotebookPaper) => void;
    onTemplateChange: (template: NotebookTemplate) => void;
    onPageSizeChange: (size: NotebookPageSize) => void;
    onAddPage: () => void;
    onSave: () => void;
    onDiscard: () => void;
    sheetZoom: number;
    onSheetZoomChange: (zoom: number) => void;
    onSheetZoomReset: () => void;
};

export function NotebookToolbar({
    mode,
    tool,
    color,
    strokeWidth,
    paper,
    template,
    pageSize,
    onModeChange,
    onToolChange,
    onColorChange,
    onStrokeWidthChange,
    onPaperChange,
    onTemplateChange,
    onPageSizeChange,
    onAddPage,
    onSave,
    onDiscard,
    sheetZoom,
    onSheetZoomChange,
    onSheetZoomReset
}: Props) {
    return (
        <header className="estudos-caderno__chrome">
            <div className="estudos-caderno__chrome-copy">
                <h3 className="estudos-caderno__title">Caderno</h3>
            </div>

            <div className="estudos-notebook-toolbar">
                <div className="estudos-notebook-toolbar__group">
                    <button
                        type="button"
                        className={`estudos-caderno__mode${mode === 'view' ? ' estudos-caderno__mode--active' : ''}`}
                        onClick={() => onModeChange('view')}
                    >
                        <MaterialIcon name="visibility" variant="app" />
                        Ver
                    </button>
                    <button
                        type="button"
                        className={`estudos-caderno__mode${mode === 'edit' ? ' estudos-caderno__mode--active' : ''}`}
                        onClick={() => onModeChange('edit')}
                    >
                        <MaterialIcon name="edit_note" variant="app" />
                        Editar
                    </button>
                </div>

                <div className="estudos-notebook-toolbar__group" role="group" aria-label="Zoom da folha">
                    <button
                        type="button"
                        className="estudos-notebook-tool"
                        aria-label="Diminuir folha"
                        title="Diminuir folha"
                        onClick={() => onSheetZoomChange(sheetZoom - SHEET_ZOOM_STEP)}
                    >
                        <MaterialIcon name="remove" variant="app" />
                    </button>
                    <button
                        type="button"
                        className="estudos-notebook-zoom-label"
                        aria-label="Resetar zoom da folha"
                        title="Resetar zoom (100%)"
                        onClick={onSheetZoomReset}
                    >
                        {sheetZoomPercent(sheetZoom)}
                    </button>
                    <button
                        type="button"
                        className="estudos-notebook-tool"
                        aria-label="Aumentar folha"
                        title="Aumentar folha"
                        onClick={() => onSheetZoomChange(sheetZoom + SHEET_ZOOM_STEP)}
                    >
                        <MaterialIcon name="add" variant="app" />
                    </button>
                </div>

                <div className="estudos-notebook-toolbar__styles" aria-label="Estilo da folha">
                    <select
                        className="estudos-notebook-paper"
                        value={paper}
                        aria-label="Cor da folha"
                        onChange={(e) => onPaperChange(e.target.value as NotebookPaper)}
                    >
                        <option value="cream">Creme</option>
                        <option value="white">Branco</option>
                        <option value="slate">Grafite</option>
                        <option value="night">Noturno</option>
                        <option value="mint">Menta</option>
                    </select>
                    <select
                        className="estudos-notebook-paper"
                        value={template}
                        aria-label="Tipo de pauta"
                        onChange={(e) => onTemplateChange(e.target.value as NotebookTemplate)}
                    >
                        <option value="lined">Pautada</option>
                        <option value="grid">Quadriculada</option>
                        <option value="dotted">Pontilhada</option>
                        <option value="blank">Em branco</option>
                    </select>
                    <select
                        className="estudos-notebook-paper"
                        value={pageSize}
                        aria-label="Tamanho da página"
                        onChange={(e) => onPageSizeChange(e.target.value as NotebookPageSize)}
                    >
                        <option value="a4">A4</option>
                        <option value="letter">Carta</option>
                        <option value="wide">Larga</option>
                    </select>
                </div>

                {mode === 'edit' ? (
                    <>
                        <div className="estudos-notebook-toolbar__group" role="group" aria-label="Ferramentas">
                            <ToolBtn
                                active={tool === 'text'}
                                icon="text_fields"
                                label="Texto"
                                onClick={() => onToolChange('text')}
                            />
                            <ToolBtn
                                active={tool === 'pen'}
                                icon="draw"
                                label="Lápis"
                                onClick={() => onToolChange('pen')}
                            />
                            <ToolBtn
                                active={tool === 'highlighter'}
                                icon="border_color"
                                label="Marca"
                                onClick={() => onToolChange('highlighter')}
                            />
                            <ToolBtn
                                active={tool === 'eraser'}
                                icon="ink_eraser"
                                label="Borracha"
                                onClick={() => onToolChange('eraser')}
                            />
                        </div>

                        <div className="estudos-notebook-toolbar__colors" role="group" aria-label="Cores">
                            {COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className={`estudos-notebook-color${color === c ? ' estudos-notebook-color--active' : ''}`}
                                    style={{ '--swatch': c } as CSSProperties & { '--swatch': string }}
                                    aria-label={`Cor ${c}`}
                                    onClick={() => onColorChange(c)}
                                />
                            ))}
                        </div>

                        <label className="estudos-notebook-stroke">
                            <span className="sr-only">Espessura do traço</span>
                            <MaterialIcon name="line_weight" variant="app" />
                            <input
                                type="range"
                                min={2}
                                max={14}
                                value={strokeWidth}
                                onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                            />
                        </label>

                        <div className="estudos-notebook-toolbar__group">
                            <FormatBtn icon="format_bold" label="Negrito" cmd="bold" />
                            <FormatBtn icon="format_italic" label="Itálico" cmd="italic" />
                            <FormatBtn icon="format_underlined" label="Sublinhado" cmd="underline" />
                            <FormatBtn icon="format_list_bulleted" label="Lista" cmd="insertUnorderedList" />
                        </div>

                        <button type="button" className="estudos-caderno__ghost" onClick={onAddPage}>
                            <MaterialIcon name="note_add" variant="app" />
                            Página
                        </button>
                        <button type="button" className="estudos-caderno__save" onClick={onSave}>
                            <MaterialIcon name="save" variant="app" />
                            Salvar
                        </button>
                        <button type="button" className="estudos-caderno__ghost" onClick={onDiscard}>
                            Cancelar
                        </button>
                    </>
                ) : null}
            </div>
        </header>
    );
}

function ToolBtn({
    active,
    icon,
    label,
    onClick
}: {
    active: boolean;
    icon: string;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            className={`estudos-notebook-tool${active ? ' estudos-notebook-tool--active' : ''}`}
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={onClick}
        >
            <MaterialIcon name={icon} variant="app" />
        </button>
    );
}

function FormatBtn({ icon, label, cmd }: { icon: string; label: string; cmd: string }) {
    return (
        <button
            type="button"
            className="estudos-notebook-tool"
            aria-label={label}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => document.execCommand(cmd, false)}
        >
            <MaterialIcon name={icon} variant="app" />
        </button>
    );
}