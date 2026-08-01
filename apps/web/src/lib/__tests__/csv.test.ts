/**
 * CSV escaping tests.
 *
 * The exports these replace built CSV with `rows.map(r => r.join(','))`. That
 * fails SILENTLY: a property named "Cowboy Siesta, Corner Lot" shifts every
 * column after it by one, and the file still opens cleanly — with the wrong
 * numbers under the wrong headings. On a file someone files taxes from, a
 * quietly-wrong column is worse than a crash.
 *
 * The second thing tested here is formula injection. A field starting with
 * = + - @ executes in Excel and Google Sheets. Property, vendor and description
 * fields are user-editable, so an exported CSV carries whatever was typed into
 * them onto an accountant's machine.
 *
 * And the third is the trap in the obvious fix: neutralising every field that
 * starts with "-" turns every negative number into text, so losses stop summing.
 */

import { describe, expect, it } from 'vitest';
import { csvCell, csvRow, money, raw, toCsv } from '../csv';

describe('delimiters and quotes', () => {
  it('quotes a field containing a comma', () => {
    expect(csvCell('Cowboy Siesta, Corner Lot')).toBe('"Cowboy Siesta, Corner Lot"');
  });

  it('the old join(",") would have shifted the columns — this does not', () => {
    const row = csvRow(['p_1', 'Cowboy Siesta, Corner Lot', raw(3)]);
    // Three fields, and the comma stays inside field two.
    expect(row).toBe('p_1,"Cowboy Siesta, Corner Lot",3');
  });

  it('doubles embedded quotes rather than breaking the field', () => {
    expect(csvCell('The "Blazing Saddle"')).toBe('"The ""Blazing Saddle"""');
  });

  it('quotes newlines so one record stays one line', () => {
    // A description with a newline would otherwise become two rows, and every
    // subsequent row would be misaligned.
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
    expect(csvCell('carriage\r\nreturn')).toBe('"carriage\r\nreturn"');
  });

  it('leaves an ordinary field alone', () => {
    expect(csvCell('Hot Tub Delight')).toBe('Hot Tub Delight');
  });

  it('emits an empty string for null and undefined, not "null"', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('formula injection', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+1', "'+1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['-cmd', "'-cmd"],
  ])('neutralises a text field starting with %s', (input, expected) => {
    expect(csvCell(input)).toBe(`"${expected}"`);
  });

  it('neutralises the classic command-execution payload', () => {
    const out = csvCell('=cmd|\' /C calc\'!A0');
    expect(out.startsWith('"\'=')).toBe(true);
    // The property that matters: unquoted, the cell no longer BEGINS with '='.
    expect(out.replace(/^"/, '').startsWith('=')).toBe(false);
  });

  it('quotes the escaped value so the apostrophe is inside the field', () => {
    // Escaping without quoting puts the apostrophe outside and does nothing.
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
  });
});

describe('numbers are NOT formula-escaped — the trap in the obvious fix', () => {
  it('keeps a negative amount numeric', () => {
    // -1234.00 starts with "-". Escaping it makes the spreadsheet treat a loss
    // as text, and it silently stops being included in any SUM.
    expect(money(-123400)).toEqual(raw('-1234.00'));
    expect(csvCell(money(-123400))).toBe('-1234.00');
    expect(csvCell(money(-123400)).startsWith("'")).toBe(false);
  });

  it('formats cents to exactly two decimal places', () => {
    expect(csvCell(money(0))).toBe('0.00');
    expect(csvCell(money(5))).toBe('0.05');
    expect(csvCell(money(50))).toBe('0.50');
    expect(csvCell(money(100))).toBe('1.00');
    expect(csvCell(money(70244400))).toBe('702444.00');
  });

  it('emits no thousands separators, which would break the import', () => {
    expect(csvCell(money(85141000))).toBe('851410.00');
    expect(csvCell(money(85141000))).not.toContain(',');
  });

  it('treats a missing amount as blank, not as zero', () => {
    // Zero is a claim ("this cost nothing"); blank is the absence of one.
    expect(csvCell(money(null))).toBe('');
    expect(csvCell(money(undefined))).toBe('');
  });

  it('rounds rather than truncating', () => {
    expect(csvCell(money(1234.6))).toBe('12.35');
  });
});

describe('document assembly', () => {
  it('uses CRLF and a BOM so Excel on Windows reads UTF-8 correctly', () => {
    const doc = toCsv(['a', 'b'], [['1', '2']]);
    expect(doc.startsWith('﻿')).toBe(true);
    expect(doc).toContain('\r\n');
  });

  it('puts the header first and one row per record', () => {
    const doc = toCsv(['property', 'gross'], [['Hot Tub Delight', money(6696000)]]);
    const lines = doc.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('property,gross');
    expect(lines[1]).toBe('Hot Tub Delight,66960.00');
    expect(lines).toHaveLength(2);
  });

  it('survives a property name carrying every hostile character at once', () => {
    const nasty = '=SUM(A1),"quoted"\nnewline';
    const doc = toCsv(['name'], [[nasty]]);
    const body = doc.replace(/^﻿/, '').slice('name\r\n'.length);
    // One field: neutralised, quoted, and the comma/newline stay inside it.
    expect(body.startsWith('"\'=')).toBe(true);
    expect(body.trimEnd().endsWith('"')).toBe(true);
  });
});
