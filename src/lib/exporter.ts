import type { ExportFormat, MonthData, Settings } from '../types';
import { saveBlob } from './download';
import { suggestedFileName } from './sheet';

export interface BuiltFile {
  name: string;
  blob: Blob;
}

/** Builds the file (libraries are loaded on demand) without downloading it. */
export async function buildExport(fmt: ExportFormat, settings: Settings, ym: string, month: MonthData, only: string[] | null, suffix: string): Promise<BuiltFile> {
  const name = suggestedFileName(settings, ym, suffix, fmt);
  if (fmt === 'xlsx') {
    const [{ default: Excel }, { buildWorkbook }] = await Promise.all([import('exceljs'), import('./workbook')]);
    const buf = await buildWorkbook(Excel, settings, ym, month, only).workbook.xlsx.writeBuffer();
    return { name, blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
  }
  const { buildPdf } = await import('./pdf');
  return { name, blob: buildPdf(settings, ym, month, only).output('blob') };
}

/** Builds the file and starts the download. Returns the file name. */
export async function runExport(fmt: ExportFormat, settings: Settings, ym: string, month: MonthData, only: string[] | null, suffix: string): Promise<string> {
  const { name, blob } = await buildExport(fmt, settings, ym, month, only, suffix);
  saveBlob(name, blob);
  return name;
}
