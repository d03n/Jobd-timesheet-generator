import type { ExportFormat, Months, Settings } from '../types';
import { saveBlob } from './download';
import { exportParts, periodFileName, type ExportLayout, type Period } from './sheet';

export interface BuiltFile {
  name: string;
  blob: Blob;
}

export interface ExportRequest {
  fmt: ExportFormat;
  period: Period;
  /** Explicit days to include (selected days / days with entries); null = the usual listing for the period. */
  only: string[] | null;
  /** Only matters when the period spans more than one month. */
  layout: ExportLayout;
  suffix: string;
}

/** Builds the file (libraries are loaded on demand) without downloading it. */
export async function buildExport(settings: Settings, months: Months, req: ExportRequest): Promise<BuiltFile> {
  const name = periodFileName(settings, req.period, req.suffix, req.fmt);
  const parts = exportParts(months, req.period, req.only, req.layout);
  if (req.fmt === 'xlsx') {
    const [{ default: Excel }, { buildPartsWorkbook }] = await Promise.all([import('exceljs'), import('./workbook')]);
    const buf = await buildPartsWorkbook(Excel, settings, parts).workbook.xlsx.writeBuffer();
    return { name, blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
  }
  const { buildPartsPdf } = await import('./pdf');
  return { name, blob: buildPartsPdf(settings, parts).output('blob') };
}

/** Builds the file and starts the download. Returns the file name. */
export async function runExport(settings: Settings, months: Months, req: ExportRequest): Promise<string> {
  const { name, blob } = await buildExport(settings, months, req);
  saveBlob(name, blob);
  return name;
}
