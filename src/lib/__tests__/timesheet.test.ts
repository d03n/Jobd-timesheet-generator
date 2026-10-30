import { describe, expect, it } from 'vitest';
import Excel from 'exceljs';
import type { MonthData, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../storage';
import { computeSheet, exportParts, listedDates, mergeMonths, periodFileName, periodLabel, periodMonths, sheetName, splitByMonth, suggestedFileName } from '../sheet';
import { holidayName } from '../holidays';
import { buildPartsWorkbook, buildWorkbook } from '../workbook';
import { buildPartsPdf } from '../pdf';
import { importTimesheet } from '../importer';

const settings: Settings = { ...DEFAULT_SETTINGS, staffName: 'Test Person', customers: ['LHB', 'CIMB', 'KTC'] };

const month: MonthData = {
  days: {
    '2024-10-01': { holiday: '', records: [
      { id: 'a', desc: '[LHB]Prepare instruction', ref: 'DO240192', cat: 'IR', cust: 'LHB', days: 0.8 },
      { id: 'b', desc: 'Investigate', ref: 'CR#2476', cat: 'CR-DEV', cust: 'CIMB', days: 0.2 },
    ] },
    '2024-10-03': { holiday: '', records: [{ id: 'c', desc: 'Leave', ref: '', cat: 'A/L', cust: 'CIMB', days: 1 }] },
    '2024-10-04': { holiday: '', records: [{ id: 'd', desc: 'Sick', ref: '', cat: 'M/L', cust: '', days: 0.5 }] },
    '2024-10-23': { holiday: 'Public holiday', records: [] },
  },
};

describe('computeSheet', () => {
  it('lists every weekday plus holidays, and totals the month', () => {
    const d = listedDates(settings, '2024-10', month);
    expect(d).toHaveLength(23);
    expect(computeSheet(settings, '2024-10', month).total).toBe(2.5);
  });

  it('subtracts leave from customer rows, like the Excel SUMIF/SUMIFS formulas', () => {
    const s = Object.fromEntries(computeSheet(settings, '2024-10', month).summary.map((r) => [r.name, r.days]));
    expect(s).toMatchObject({ LHB: 0.8, CIMB: 0.2, 'Annual Leave': 1, 'Medical Leave': 0.5 });
  });

  it('restricts to the given days so 100% = those days', () => {
    expect(computeSheet(settings, '2024-10', month, ['2024-10-01']).total).toBe(1);
  });
});

describe('holidays', () => {
  it('knows Bank of Thailand holidays and the Bangkok-only toggle', () => {
    expect(holidayName(settings, '2026-10-23')).toMatch(/Chulalongkorn/);
    expect(holidayName(settings, '2026-10-16')).toMatch(/Bangkok/);
    expect(holidayName({ ...settings, botBangkok: false }, '2026-10-16')).toBe('');
    expect(holidayName({ ...settings, useBotHolidays: false }, '2026-10-23')).toBe('');
  });
});

describe('buildWorkbook', () => {
  const { workbook } = buildWorkbook(Excel, settings, '2024-10', month);
  const ws = workbook.worksheets[0];
  const find = (text: string) => {
    let hit = 0;
    ws.eachRow((row, n) => row.eachCell((c) => { if (c.value === text) hit = n; }));
    return hit;
  };

  it('writes live formulas for utilization, TOTAL and SUMMARY', () => {
    const t = find('TOTAL');
    expect(ws.getCell(`G${t}`).formula).toBe(`SUM(G7:G${t - 1})`);
    expect(ws.getCell('H7').formula).toBe(`IF((G7)>0,(G7)/($G$${t}),"")`);
    const lhb = find('LHB');
    expect(ws.getCell(`D${lhb}`).formula).toMatch(/^SUMIF\(.*\)-SUMIFS\(.*\)-SUMIFS\(.*\)$/);
    expect(ws.getCell(`D${lhb}`).result).toBe(0.8);
  });

  it('adds dropdowns and hides the category list', () => {
    expect(ws.getCell('E7').dataValidation?.type).toBe('list');
    const label = find('Category list (used by the Category dropdown)');
    expect(ws.getRow(label).hidden).toBe(true);
    expect(ws.getRow(label + 1).hidden).toBe(true);
  });

  it('round-trips through the importer', async () => {
    const buf = await workbook.xlsx.writeBuffer();
    const res = await importTimesheet(Excel, buf as ArrayBuffer, settings);
    expect(res.period).toEqual({ start: '2024-10-01', end: '2024-10-31' });
    expect(res.count).toBe(4);
    expect(res.staff).toBe('Test Person');
    expect(res.days['2024-10-23'].holiday).toBe('Public holiday');
    expect(res.days['2024-10-01'].records[0]).toMatchObject({ desc: '[LHB]Prepare instruction', cust: 'LHB', days: 0.8 });
  });
});

describe('suggestedFileName', () => {
  it('uses the first name, month and suffix', () => {
    expect(suggestedFileName(settings, '2024-10', '_entries', 'pdf')).toBe('Test_Job-D_Oct_2024_entries.pdf');
  });
});

describe('periods across months', () => {
  const cut = { start: '2026-10-21', end: '2026-11-20' };
  const months = {
    '2026-10': { days: {
      '2026-10-20': { holiday: '', records: [{ id: 'x', desc: 'Before the cut-off', ref: '', cat: 'IR', cust: 'LHB', days: 1 }] },
      '2026-10-21': { holiday: '', records: [{ id: 'a', desc: 'Oct work', ref: '', cat: 'IR', cust: 'LHB', days: 1 }] },
    } },
    '2026-11': { days: {
      '2026-11-02': { holiday: '', records: [{ id: 'b', desc: 'Nov work', ref: '', cat: 'CR-DEV', cust: 'CIMB', days: 0.5 }] },
      '2026-11-25': { holiday: '', records: [{ id: 'y', desc: 'After the cut-off', ref: '', cat: 'IR', cust: 'KTC', days: 1 }] },
    } },
  };

  it('splits, labels and names a cut-off period', () => {
    expect(periodMonths(cut)).toEqual(['2026-10', '2026-11']);
    expect(periodMonths({ start: '2026-12-21', end: '2027-01-20' })).toEqual(['2026-12', '2027-01']);
    expect(splitByMonth(cut)).toEqual([{ start: '2026-10-21', end: '2026-10-31' }, { start: '2026-11-01', end: '2026-11-20' }]);
    expect(periodLabel(cut)).toBe('21 Oct – 20 Nov 2026');
    expect(periodLabel({ start: '2026-10-01', end: '2026-10-31' })).toBe('October 2026');
    expect(periodLabel({ start: '2026-12-21', end: '2027-01-20' })).toBe('21 Dec 2026 – 20 Jan 2027');
    expect(sheetName(cut)).toBe('JobD-21Oct-20Nov-2026');
    expect(sheetName({ start: '2026-10-21', end: '2026-10-31' })).toBe('JobD-21-31Oct-2026');
    expect(sheetName({ start: '2026-12-21', end: '2027-01-20' }).length).toBeLessThanOrEqual(31);
    expect(periodFileName(settings, cut, '', 'pdf')).toBe('Test_Job-D_21Oct2026-20Nov2026.pdf');
    expect(periodFileName(settings, { start: '2026-10-01', end: '2026-10-31' })).toBe('Test_Job-D_Oct_2026.xlsx');
  });

  it('only counts days inside the period', () => {
    const merged = mergeMonths(months, cut);
    expect(Object.keys(merged.days).sort()).toEqual(['2026-10-21', '2026-11-02']);
    const data = computeSheet(settings, cut, merged);
    expect(data.total).toBe(1.5);
    expect(data.rows[0].date).toBe('2026-10-21');
  });

  it('builds one sheet per month, or one combined sheet', async () => {
    const per = buildPartsWorkbook(Excel, settings, exportParts(months, cut, null, 'per-month'));
    expect(per.sheets.map((x) => [x.sheetName, x.total])).toEqual([['JobD-21-31Oct-2026', 1], ['JobD-1-20Nov-2026', 0.5]]);
    const one = buildPartsWorkbook(Excel, settings, exportParts(months, cut, null, 'combined'));
    expect(one.sheets.map((x) => [x.sheetName, x.total])).toEqual([['JobD-21Oct-20Nov-2026', 1.5]]);

    // Both layouts import back to the same days, across both months.
    for (const wb of [per.workbook, one.workbook]) {
      const res = await importTimesheet(Excel, (await wb.xlsx.writeBuffer()) as ArrayBuffer, settings);
      expect(res.period).toEqual({ start: '2026-10-21', end: '2026-11-20' });
      expect(res.count).toBe(2);
      expect(res.days['2026-11-02'].records[0]).toMatchObject({ desc: 'Nov work', days: 0.5 });
    }
  });

  it('leaves out months with no chosen days', () => {
    const parts = exportParts(months, cut, ['2026-11-02'], 'per-month');
    expect(parts.map((p) => p.name)).toEqual(['JobD-1-20Nov-2026']);
  });

  it('starts each PDF section on a new page', () => {
    const per = buildPartsPdf(settings, exportParts(months, cut, null, 'per-month'));
    const one = buildPartsPdf(settings, exportParts(months, cut, null, 'combined'));
    expect(per.getNumberOfPages()).toBe(one.getNumberOfPages() + 1);
  });
});

describe('import keeps to the dates in the file', () => {
  const oct = { '2024-10': month };

  it('lists only the dates the file contains, so other days are not replaced', async () => {
    const wb = buildPartsWorkbook(Excel, settings, exportParts(oct, { start: '2024-10-01', end: '2024-10-31' }, ['2024-10-01', '2024-10-04'], 'combined')).workbook;
    const res = await importTimesheet(Excel, (await wb.xlsx.writeBuffer()) as ArrayBuffer, settings);
    expect(Object.keys(res.days).sort()).toEqual(['2024-10-01', '2024-10-04']);
    expect(res.ym).toBe('2024-10');
  });

  it('does not double entries when sheets overlap', async () => {
    const p = { start: '2024-10-01', end: '2024-10-31' };
    const parts = [...exportParts(oct, p, null, 'combined'), { ...exportParts(oct, p, null, 'combined')[0], name: 'Copy' }];
    const wb = buildPartsWorkbook(Excel, settings, parts).workbook;
    const res = await importTimesheet(Excel, (await wb.xlsx.writeBuffer()) as ArrayBuffer, settings);
    expect(res.count).toBe(4);
    expect(res.days['2024-10-01'].records).toHaveLength(2);
  });
});
