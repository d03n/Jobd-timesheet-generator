import type { ExportFormat, MonthData, Settings } from '../types';
import { saveBlob } from './download';
import { suggestedFileName } from './sheet';

/** Builds the file (libraries are loaded on demand) and starts the download. Returns the file name. */
export async function runExport(fmt: ExportFormat, settings: Settings, ym: string, month: MonthData, only: string[] | null, suffix: string): Promise<string> {
  const name = suggestedFileName(settings, ym, suffix, fmt);
  if (fmt === 'xlsx') {
    const [{ default: Excel }, { buildWorkbook }] = await Promise.all([import('exceljs'), import('./workbook')]);
    const buf = await buildWorkbook(Excel, settings, ym, month, only).workbook.xlsx.writeBuffer();
    saveBlob(name, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  } else {
    const { buildPdf } = await import('./pdf');
    saveBlob(name, buildPdf(settings, ym, month, only).output('blob'));
  }
  return name;
}
