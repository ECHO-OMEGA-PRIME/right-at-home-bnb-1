/**
 * CSV generation for financial exports.
 *
 * The two client-side exports that existed (app/admin/accounting/reports and
 * app/admin/finance) built CSV by string concatenation with NO escaping:
 *
 *     const csvContent = [headers.join(','), ...rows.map(r => r.join(','))]
 *
 * A property named "Cowboy Siesta, Corner Lot" silently shifts every column
 * after it by one, and nothing about the resulting file looks wrong — it opens
 * cleanly, with the wrong numbers under the wrong headings. That is the failure
 * mode that matters for a file someone files taxes from.
 *
 * FORMULA INJECTION
 * A field beginning with = + - @ (or a tab/carriage return) is executed as a
 * formula by Excel, Google Sheets and LibreOffice. Property names, vendor names
 * and descriptions are user-editable, so an exported CSV is a delivery vehicle
 * for whatever someone typed into a name field, aimed at an accountant's
 * machine. Text fields are neutralised with a leading apostrophe.
 *
 * NUMBERS ARE NOT NEUTRALISED, ON PURPOSE
 * A naive implementation escapes every field starting with "-" and turns every
 * negative number into text — so a $-1,234.00 loss silently stops summing in
 * the spreadsheet. Numbers are formatted by this module and never come from
 * user input, so they are emitted raw. That distinction is the whole reason
 * `csvNumber` exists as a separate type rather than everything being a string.
 */

/** A cell that must never be treated as a formula, however it starts. */
export type CsvCell = string | number | null | undefined | { raw: string };

/** Mark a value as pre-formatted and safe to emit unescaped (numbers, dates). */
export const raw = (value: string | number): { raw: string } => ({ raw: String(value) });

/** Cents to a plain decimal string. No thousands separators — those break imports. */
export function money(cents: number | null | undefined): { raw: string } {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return raw('');
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return raw(negative ? `-${s}` : s);
}

const NEEDS_QUOTING = /[",\r\n]/;
// Leading characters a spreadsheet treats as the start of a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Escape one cell.
 *
 * Order matters: neutralise the formula first, then quote, or the apostrophe
 * ends up outside the quotes and does nothing.
 */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'raw' in value) {
    // Pre-formatted by us. Still quoted if it somehow contains a delimiter, but
    // never formula-escaped — that is what keeps negative numbers numeric.
    const r = value.raw;
    return NEEDS_QUOTING.test(r) ? `"${r.replace(/"/g, '""')}"` : r;
  }

  let s = typeof value === 'number' ? String(value) : value;
  if (FORMULA_START.test(s)) s = `'${s}`;
  // RFC 4180: double up embedded quotes, wrap the field.
  return NEEDS_QUOTING.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: CsvCell[]): string {
  return cells.map(csvCell).join(',');
}

/**
 * Build a complete CSV document.
 *
 * CRLF line endings and a UTF-8 BOM: Excel on Windows misreads a UTF-8 file
 * without the BOM as the local codepage, which mangles any non-ASCII character
 * in a property or guest name. The people opening these files are on Windows.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Headers for a CSV download, with the row count stated so an empty file is obvious. */
export function csvHeaders(filename: string, rowCount: number): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    // Quoted so a filename containing a space or comma cannot truncate the name.
    'Content-Disposition': `attachment; filename="${filename.replace(/["\\]/g, '')}"`,
    'X-Export-Rows': String(rowCount),
    'Cache-Control': 'no-store',
  };
}
