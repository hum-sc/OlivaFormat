import type {Cell, MarkdownCell, Oli, Page} from '../oli.d.ts';
import * as fs from 'fs';
export default class NotebookOliva implements Oli {
    public metadata: Oli['metadata'];
    public pages: Page[];
    public nbformat: number;
    public nbformat_minor: number;
    public minSizeCell: number = 10;
    
    private blankCellTemplate: MarkdownCell = {
        cell_type: 'markdown',
        id: '',
        metadata: {
            name: '',
        },
        source: '',
        size: this.minSizeCell,
    }

    private blankPageTemplate: Page = {
        id: '',
        content: {
            name: 'Contenido',
            cells: [{...this.blankCellTemplate, id: 'content-cell-0' } ],
        },
        cue:{
            name: 'Cue',
            cells: [{...this.blankCellTemplate, id: 'cue-cell-0' }],
        },
        summary:{
            name: 'Resumen',
            cells: [{...this.blankCellTemplate, id: 'summary-cell-0' }],
        },
    };

    constructor(
        id: string,
        title: string = "Libreta sin título",
        authorName: string,
        authorId: string="",
        paperDimensions: { name: string; width: number; height: number } = { name: 'A4', width: 210, height: 297 },
        orientation: 'portrait' | 'landscape' = 'portrait',
        basefontSize: number = 12,
        bodyFontFamily: Oli['metadata']['body_font_family'] = {
            name: 'Inter',
            url: 'https://fonts.googleapis.com/css2?family=Inter&display=swap',
            generic_family: 'sans-serif',
        },
        headerFontFamily: Oli['metadata']['headerfont'] = {
            family: 'Work Sans',
            url: 'https://fonts.googleapis.com/css2?family=Work+Sans&display=swap',
            generic_family: 'sans-serif',
        },
        pageColumns: number = 3,
        pageRows: number = 4,
        cueColumns: number = 1,
        summaryRows: number = 1,
        minSizeCell: number = 10, //In mm
    ){
        this.minSizeCell = minSizeCell;
        this.metadata = {
            title: title,
            author:{
                name: authorName,
                id: authorId,
            },
            paper:{
                dimensions: paperDimensions,
                orientation: orientation
            },
            base_font_size: basefontSize,
            headerfont: {
                family: "Arial Black",
            },
            id: id,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            page_layout:{
                columns: pageColumns,
                rows: pageRows,
                cue_section:{
                    columns: cueColumns,
                    rows: pageRows-summaryRows,
                },
                summary_section:{
                    columns: pageColumns,
                    rows: summaryRows,
                },
                content_section:{
                    columns: pageColumns - cueColumns,
                    rows: pageRows - summaryRows,
                }
            }
            
        };
        
        this.pages = [{...this.blankPageTemplate, id: 'page-0' }];
        this.nbformat = 0;
        this.nbformat_minor = 1;
    }

    addPage(): void {
        const newPageId = `page-${this.pages.length}`;
        const newPage: Page = {
            ...this.blankPageTemplate,
            id: newPageId,
        };
        this.pages.push(newPage);
    }
    movePage(oldIndex: number, newIndex: number): void {
        if (oldIndex < 0 || oldIndex >= this.pages.length || newIndex < 0 || newIndex >= this.pages.length) {
            throw new Error('Invalid page index');
        }
        const [movedPage] = this.pages.splice(oldIndex, 1);
        this.pages.splice(newIndex, 0, movedPage!);
    }
    deletePage(pageIndex: number): void {
        if (pageIndex < 0 || pageIndex >= this.pages.length) {
            throw new Error('Invalid page index');
        }
        this.pages.splice(pageIndex, 1);
    }

    addCellToPage(pageIndex: number, section: 'content' | 'cue' | 'summary'): void {
        const page = this.pages[pageIndex];
        if (!page) {
            throw new Error(`Page at index ${pageIndex} does not exist.`);
        }

        const sectionObj = page[section];
        if (!sectionObj) {
            throw new Error(`Section ${section} does not exist on page ${page.id}.`);
        }

        const newCellId = `${section}-cell-${sectionObj.cells.length}`;
        const newCell: MarkdownCell = {
            ...this.blankCellTemplate,
            id: newCellId,
            size: this.minSizeCell,
        };
        
        const sectionRowSize = this.metadata.paper!.dimensions!.height / this.metadata.page_layout.rows!;
        const sectionRows = section === 'cue' ? this.metadata.page_layout.cue_section!.rows! :
                            section === 'summary' ? this.metadata.page_layout.summary_section!.rows! :
                            this.metadata.page_layout.content_section!.rows!;
        const maxSectionSize = sectionRowSize * sectionRows;
        const currentSectionSize = sectionObj.cells.reduce((total, cell) => total + (cell as MarkdownCell).size || 0, 0);
        if (currentSectionSize + newCell.size! > maxSectionSize) {
            throw new Error(`Cannot add new cell to ${section} section on page ${page.id}: exceeds maximum section size of ${maxSectionSize} mm.`);
        }
        sectionObj.cells.push(newCell);
    }
    moveCellInSection(pageIndex: number, section: 'content' | 'cue' | 'summary', oldCellIndex: number, newCellIndex: number): void {
        const page = this.pages[pageIndex];
        if (!page) {
            throw new Error(`Page at index ${pageIndex} does not exist.`);
        }

        const sectionObj = page[section];
        if (!sectionObj) {
            throw new Error(`Section ${section} does not exist on page ${page.id}.`);
        }

        if (oldCellIndex < 0 || oldCellIndex >= sectionObj.cells.length || newCellIndex < 0 || newCellIndex >= sectionObj.cells.length) {
            throw new Error('Invalid cell index');
        }

        const [movedCell] = sectionObj.cells.splice(oldCellIndex, 1);
        sectionObj.cells.splice(newCellIndex, 0, movedCell!);
    }
    moveCellToAnotherSection(pageIndex: number, fromSection: 'content' | 'cue' | 'summary', toSection: 'content' | 'cue' | 'summary', cellIndex: number): void {
        const page = this.pages[pageIndex];
        if (!page) {
            throw new Error(`Page at index ${pageIndex} does not exist.`);
        }
        
        const fromSectionObj = page[fromSection];
        const toSectionObj = page[toSection];

        if (!fromSectionObj || !toSectionObj) {
            throw new Error(`One of the sections ${fromSection} or ${toSection} does not exist on page ${page.id}.`);
        }
        
        if (cellIndex < 0 || cellIndex >= fromSectionObj.cells.length) {
            throw new Error('Invalid cell index');
        }

        const [movedCell] = fromSectionObj.cells.splice(cellIndex, 1);
        
        const toSectionRowSize = this.metadata.paper!.dimensions!.height / this.metadata.page_layout.rows!;
        const toSectionRows = toSection === 'cue' ? this.metadata.page_layout.cue_section!.rows! :
                                toSection === 'summary' ? this.metadata.page_layout.summary_section!.rows! :
                                this.metadata.page_layout.content_section!.rows!;
        const maxToSectionSize = toSectionRowSize * toSectionRows;
        const currentToSectionSize = toSectionObj.cells.reduce((total, cell) => total + (cell as MarkdownCell).size || 0, 0);
        if (currentToSectionSize + (movedCell as MarkdownCell).size! > maxToSectionSize) {
            // Revert the removal
            fromSectionObj.cells.splice(cellIndex, 0, movedCell!);
            throw new Error(`Cannot move cell to ${toSection} section on page ${page.id}: exceeds maximum section size of ${maxToSectionSize} mm.`);
        }
        
        toSectionObj.cells.push(movedCell!);
    }

    moveCellToAnotherPage(fromPageIndex: number, toPageIndex: number, section: 'content' | 'cue' | 'summary', cellIndex: number): void {
        const fromPage = this.pages[fromPageIndex];
        const toPage = this.pages[toPageIndex];

        if (!fromPage || !toPage) {
            throw new Error(`One of the pages at index ${fromPageIndex} or ${toPageIndex} does not exist.`);
        }

        const fromSectionObj = fromPage[section];
        const toSectionObj = toPage[section];

        if (!fromSectionObj || !toSectionObj) {
            throw new Error(`Section ${section} does not exist on one of the pages.`);
        }

        if (cellIndex < 0 || cellIndex >= fromSectionObj.cells.length) {
            throw new Error('Invalid cell index');
        }

        const [movedCell] = fromSectionObj.cells.splice(cellIndex, 1);

        const toSectionRowSize = this.metadata.paper!.dimensions!.height / this.metadata.page_layout.rows!;
        const sectionRows = section === 'cue' ? this.metadata.page_layout.cue_section!.rows! :
                            section === 'summary' ? this.metadata.page_layout.summary_section!.rows! :
                            this.metadata.page_layout.content_section!.rows!;
        const maxToSectionSize = toSectionRowSize * sectionRows;
        const currentToSectionSize = toSectionObj.cells.reduce((total, cell) => total + (cell as MarkdownCell).size || 0, 0);
        if (currentToSectionSize + (movedCell as MarkdownCell).size! > maxToSectionSize) {
            // Revert the removal
            fromSectionObj.cells.splice(cellIndex, 0, movedCell!);
            throw new Error(`Cannot move cell to ${section} section on page ${toPage.id}: exceeds maximum section size of ${maxToSectionSize} mm.`);
        }

        toSectionObj.cells.push(movedCell!);
    }

    deleteCell(pageIndex: number, section: 'content' | 'cue' | 'summary', cellIndex: number): void {
        const page = this.pages[pageIndex];
        if (!page) {
            throw new Error(`Page at index ${pageIndex} does not exist.`);
        }

        const sectionObj = page[section];
        if (!sectionObj) {
            throw new Error(`Section ${section} does not exist on page ${page.id}.`);
        }

        if (cellIndex < 0 || cellIndex >= sectionObj.cells.length) {
            throw new Error('Invalid cell index');
        }

        sectionObj.cells.splice(cellIndex, 1);
    }
    static notebookFromFile(path: string): NotebookOliva {
        const file = fs.readFileSync(path, 'utf-8');
        const obj = JSON.parse(file) as Oli;
        const notebook = new NotebookOliva(
            obj.metadata.id!,
            obj.metadata.title,
            obj.metadata.author!.name!,
            obj.metadata.author!.id!,
            obj.metadata.paper!.dimensions!,
            obj.metadata.paper!.orientation!,
            obj.metadata.base_font_size!,
            obj.metadata.body_font_family!,
            obj.metadata.headerfont!,
            obj.metadata.page_layout.columns!,
            obj.metadata.page_layout.rows!,
            obj.metadata.page_layout.cue_section!.columns!,
            obj.metadata.page_layout.summary_section!.rows!,
        );
        notebook.pages = obj.pages;
        notebook.nbformat = obj.nbformat;
        notebook.nbformat_minor = obj.nbformat_minor;
        return notebook;
    }

    static notebookFromString(data: string): NotebookOliva {
        const obj = JSON.parse(data) as Oli;
        const notebook = new NotebookOliva(
            obj.metadata.id!,
            obj.metadata.title,
            obj.metadata.author!.name!,
            obj.metadata.author!.id!,
            obj.metadata.paper!.dimensions!,
            obj.metadata.paper!.orientation!,
            obj.metadata.base_font_size!,
            obj.metadata.body_font_family!,
            obj.metadata.headerfont!,
            obj.metadata.page_layout.columns!,
            obj.metadata.page_layout.rows!,
            obj.metadata.page_layout.cue_section!.columns!,
            obj.metadata.page_layout.summary_section!.rows!,
        );
        notebook.pages = obj.pages;
        notebook.nbformat = obj.nbformat;
        notebook.nbformat_minor = obj.nbformat_minor;
        return notebook;
    }

    static notebookFromJSON(jsonData: Oli): NotebookOliva {
        const notebook = new NotebookOliva(
            jsonData.metadata.id!,
            jsonData.metadata.title,
            jsonData.metadata.author!.name!,
            jsonData.metadata.author!.id!,
            jsonData.metadata.paper!.dimensions!,
            jsonData.metadata.paper!.orientation!,
            jsonData.metadata.base_font_size!,
            jsonData.metadata.body_font_family!,
            jsonData.metadata.headerfont!,
            jsonData.metadata.page_layout.columns!,
            jsonData.metadata.page_layout.rows!,
            jsonData.metadata.page_layout.cue_section!.columns!,
            jsonData.metadata.page_layout.summary_section!.rows!,
        );
        notebook.pages = jsonData.pages;
        notebook.nbformat = jsonData.nbformat;
        notebook.nbformat_minor = jsonData.nbformat_minor;
        return notebook;
    }

    writeToFile(path: string): void {
        const oliNotebook: Oli = {
            metadata: this.metadata,
            pages: this.pages,
            nbformat: this.nbformat,
            nbformat_minor: this.nbformat_minor,
        };
        const data = JSON.stringify(oliNotebook, null, 2);
        fs.writeFileSync(path, data, 'utf-8');
    }
    
    serialize(): string {
        const oliNotebook: Oli = {
            metadata: this.metadata,
            pages: this.pages,
            nbformat: this.nbformat,
            nbformat_minor: this.nbformat_minor,
        };
        return JSON.stringify(oliNotebook, null, 2);
    }
    
    changeDimensions(width: number, height: number, name?: string, orientation?: 'portrait' | 'landscape'): void {
        this.metadata.paper!.dimensions = { name: name || this.metadata.paper!.dimensions!.name, width, height };
        if (orientation) {
            this.metadata.paper!.orientation = orientation;
        }
        this.verifyCellSizeConstraints(this.pages[0]!, 'content', []);
        this.verifyCellSizeConstraints(this.pages[0]!, 'cue', []);
        this.verifyCellSizeConstraints(this.pages[0]!, 'summary', []);
    }
    private verifyCellSizeConstraints(page: Page, section: 'content' | 'cue' | 'summary', overflowedCellLastPage: Cell[]): void {
        const sectionObj = page[section];
        if (!sectionObj) {
            throw new Error(`Section ${section} does not exist on page ${page.id}.`);
        }
        sectionObj.cells = [...overflowedCellLastPage, ...sectionObj.cells];
        const sectionRowSize = this.metadata.paper!.dimensions!.height / this.metadata.page_layout.rows!;
        const sectionRows = section === 'cue' ? this.metadata.page_layout.cue_section!.rows! :
                            section === 'summary' ? this.metadata.page_layout.summary_section!.rows! :
                            this.metadata.page_layout.content_section!.rows!;
        const maxSectionSize = sectionRowSize * sectionRows;
        let currentSectionSize = 0;
        const overflowedCells: Cell[] = [];
        for (const cell of sectionObj.cells) {
            const cellSize = (cell as MarkdownCell).size || 0;
            if (currentSectionSize + cellSize <= maxSectionSize) {
                currentSectionSize += cellSize;
            } else {
                overflowedCells.push(cell);
            }
        }
        sectionObj.cells = sectionObj.cells.filter(cell => !overflowedCells.includes(cell));
        const pageIndex = this.pages.indexOf(page);
        if (overflowedCells.length > 0) {
            if (pageIndex === this.pages.length - 1) {
                this.addPage();
            }
            this.verifyCellSizeConstraints(this.pages[pageIndex + 1]!, section, overflowedCells);
        } else {
            if (pageIndex < this.pages.length - 1) {
                this.verifyCellSizeConstraints(this.pages[pageIndex + 1]!, section, []);
            } else {
                return;
            }    
        }
    }
}