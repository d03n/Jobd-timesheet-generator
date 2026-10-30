import { describe, expect, it } from 'vitest';
import Excel from 'exceljs';
import type { MonthData, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../storage';
import { computeSheet, listedDates, suggestedFileName } from '../sheet';
import { holidayName } from '../holidays';
import { buildWorkbook } from '../workbook';
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
    expect(res.ym).toBe('2024-10');
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
