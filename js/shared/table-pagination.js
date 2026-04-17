/**
 * Paginação reutilizável para tabelas (10 / 25 / 100 linhas).
 * Estado do tamanho de página persiste em localStorage por `storageKey`.
 */

const STORAGE_PREFIX = 'fullfinan-table-pageSize-';
export const TABLE_PAGE_SIZES = [10, 25, 100];

export class TablePaginationController {
    /**
     * @param {HTMLElement | null} containerEl - elemento onde a barra é montada
     * @param {{ storageKey?: string, onChange?: () => void }} [options]
     */
    constructor(containerEl, options = {}) {
        this.containerEl = containerEl;
        this.storageKey = options.storageKey || 'default';
        this.onChange = options.onChange || (() => {});
        this.page = 1;
        this.pageSize = this._readStoredSize();
        this.totalItems = 0;
        this._buildDom();
        this._bind();
    }

    _readStoredSize() {
        try {
            const v = parseInt(localStorage.getItem(STORAGE_PREFIX + this.storageKey), 10);
            if (TABLE_PAGE_SIZES.includes(v)) return v;
        } catch {
            /* ignore */
        }
        return 25;
    }

    _writeStoredSize() {
        try {
            localStorage.setItem(STORAGE_PREFIX + this.storageKey, String(this.pageSize));
        } catch {
            /* ignore */
        }
    }

    /**
     * @param {number} n - total de linhas de dados
     * @param {{ resetPage?: boolean }} [options] - `resetPage: true` volta à página 1 (ex.: após filtrar)
     */
    setTotal(n, options = {}) {
        const resetPage = options.resetPage === true;
        this.totalItems = Math.max(0, Math.floor(Number(n)) || 0);
        const maxPage = Math.max(1, Math.ceil(this.totalItems / this.pageSize) || 1);
        if (resetPage) this.page = 1;
        else if (this.totalItems === 0) this.page = 1;
        else if (this.page > maxPage) this.page = maxPage;
        this._updateUi();
    }

    /** Índices [start, end) para usar com Array.prototype.slice */
    getSliceRange() {
        const start = (this.page - 1) * this.pageSize;
        const end = Math.min(start + this.pageSize, this.totalItems);
        return { start, end };
    }

    /** Estado atual (útil para paginação no servidor). */
    getState() {
        return { page: this.page, pageSize: this.pageSize };
    }

    _buildDom() {
        this.containerEl.innerHTML = `
            <div class="table-pagination" role="navigation" aria-label="Paginação da tabela">
                <label class="table-pagination__size">
                    <span class="table-pagination__size-label">Linhas por página</span>
                    <select class="table-pagination__select" data-pagination-select aria-label="Linhas por página"></select>
                </label>
                <span class="table-pagination__info" data-pagination-info></span>
                <div class="table-pagination__nav">
                    <button type="button" class="table-pagination__btn" data-pagination-prev aria-label="Página anterior">
                        <i class="fas fa-chevron-left" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="table-pagination__btn" data-pagination-next aria-label="Próxima página">
                        <i class="fas fa-chevron-right" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        `;
        this.selectEl = this.containerEl.querySelector('[data-pagination-select]');
        this.infoEl = this.containerEl.querySelector('[data-pagination-info]');
        this.prevBtn = this.containerEl.querySelector('[data-pagination-prev]');
        this.nextBtn = this.containerEl.querySelector('[data-pagination-next]');

        TABLE_PAGE_SIZES.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = String(s);
            opt.textContent = String(s);
            this.selectEl.appendChild(opt);
        });
        this.selectEl.value = String(this.pageSize);
    }

    _bind() {
        this.selectEl.addEventListener('change', () => {
            const v = parseInt(this.selectEl.value, 10);
            this.pageSize = TABLE_PAGE_SIZES.includes(v) ? v : 25;
            this.page = 1;
            this._writeStoredSize();
            this.setTotal(this.totalItems);
            this.onChange();
        });

        this.prevBtn.addEventListener('click', () => {
            if (this.page <= 1) return;
            this.page -= 1;
            this._updateUi();
            this.onChange();
        });

        this.nextBtn.addEventListener('click', () => {
            const maxPage = Math.max(1, Math.ceil(this.totalItems / this.pageSize) || 1);
            if (this.page >= maxPage) return;
            this.page += 1;
            this._updateUi();
            this.onChange();
        });
    }

    _updateUi() {
        const { start, end } = this.getSliceRange();
        const maxPage = Math.max(1, Math.ceil(this.totalItems / this.pageSize) || 1);

        if (this.totalItems === 0) {
            this.infoEl.textContent = 'Nenhum registro';
        } else {
            const from = start + 1;
            const to = end;
            this.infoEl.textContent = `${from}–${to} de ${this.totalItems} · Página ${this.page} de ${maxPage}`;
        }

        this.prevBtn.disabled = this.page <= 1 || this.totalItems === 0;
        this.nextBtn.disabled = this.page >= maxPage || this.totalItems === 0;
    }
}
