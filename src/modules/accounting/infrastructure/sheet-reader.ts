import { detectHeaderRow, recognizeHeader } from '../domain/column-mapping';
import type { CellValue, IncomeField, SheetRow } from '../domain/types';

/**
 * Spreadsheet adapter. SheetJS is the only place that knows about file formats; it is loaded
 * on demand so the rest of the site never pays for it.
 */

export interface SheetData {
  name: string;
  /** Rows from sheet row 1 (blank ones included), trailing blanks removed. */
  rows: SheetRow[];
  headerRowIndex: number;
  /** Distinct fields recognized in the header row: how "income-like" the sheet is. */
  headerScore: number;
}

export interface WorkbookData {
  filename: string;
  format: 'xlsx' | 'csv';
  sheets: SheetData[];
  /** Index of the sheet that looks most like an income ledger. */
  defaultSheet: number;
}

export type FileInput = Blob | ArrayBuffer | Uint8Array;

const IGNORED_SHEETS = /^(instrucciones|instructions|listas|lists|ayuda|help|leeme|readme)$/i;
const TEXT_EXTENSIONS = /\.(csv|tsv|txt)$/i;

export function detectDelimiter(text: string): ';' | ',' | '\t' {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 5);
  const counts = { ';': 0, ',': 0, '\t': 0 };
  for (const line of lines) {
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char in counts) counts[char as keyof typeof counts]++;
    }
  }
  // Colombian exports use ";" and put decimal commas inside the numbers, so ";" wins ties.
  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) return ';';
  if (counts['\t'] > counts[',']) return '\t';
  return counts[','] > 0 ? ',' : ';';
}

/** UTF-8 first (the byte order mark is dropped); Windows-1252 for legacy exports. */
export function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('windows-1252').decode(bytes);
}

async function toBytes(input: FileInput): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(await input.arrayBuffer());
}

/** .xlsx is a zip (PK) and legacy .xls is an OLE container; anything else is not a spreadsheet. */
function looksLikeSpreadsheet(bytes: Uint8Array): boolean {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return zip || ole;
}

function trimTrailingBlanks(rows: SheetRow[]): SheetRow[] {
  let end = rows.length;
  while (end > 0 && rows[end - 1]!.every((cell) => cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === ''))) {
    end--;
  }
  return rows.slice(0, end);
}

function headerScore(rows: readonly SheetRow[], headerRowIndex: number): number {
  const fields = new Set<IncomeField>();
  for (const cell of rows[headerRowIndex] ?? []) {
    const match = recognizeHeader(cell);
    if (match) fields.add(match.field);
  }
  return fields.size;
}

/**
 * Reads an .xlsx, .xls or .csv file into plain rows.
 *
 * - Excel files are read with real dates (`cellDates`); numeric serials are handled downstream.
 * - CSV text is kept as written (`raw`), because `1.234.567,00` must not be guessed as a number.
 */
export async function readWorkbook(input: FileInput, filename: string): Promise<WorkbookData> {
  const bytes = await toBytes(input);
  const isText = TEXT_EXTENSIONS.test(filename);
  if (!isText && !looksLikeSpreadsheet(bytes)) throw new Error('El archivo no parece un Excel (.xlsx, .xls) ni un CSV.');
  const XLSX = await import('xlsx');

  const workbook = isText
    ? (() => {
        const text = decodeText(bytes);
        return XLSX.read(text, { type: 'string', raw: true, FS: detectDelimiter(text) });
      })()
    : XLSX.read(bytes, { type: 'array', cellDates: true });

  const sheets: SheetData[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]!;
    const ref = sheet['!ref'];
    let rows: SheetRow[] = [];
    if (ref) {
      // Always start at A1 so array positions match sheet rows, even if the data starts lower.
      const end = XLSX.utils.decode_range(ref).e;
      const range = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: end });
      rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true, range });
    }
    rows = trimTrailingBlanks(rows);
    const headerRowIndex = detectHeaderRow(rows);
    return { name, rows, headerRowIndex, headerScore: headerScore(rows, headerRowIndex) };
  });

  if (sheets.length === 0) throw new Error('El archivo no tiene hojas.');

  let defaultSheet = -1;
  let best = -1;
  sheets.forEach((sheet, index) => {
    const score = IGNORED_SHEETS.test(sheet.name.trim()) ? sheet.headerScore - 100 : sheet.headerScore;
    if (score > best) {
      best = score;
      defaultSheet = index;
    }
  });

  return { filename, format: isText ? 'csv' : 'xlsx', sheets, defaultSheet: Math.max(0, defaultSheet) };
}
