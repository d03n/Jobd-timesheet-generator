/** One logged piece of work — becomes one row in the Job-D sheet. */
export interface EntryRecord {
  id: string;
  desc: string;
  ref: string;
  cat: string;
  cust: string;
  /** Fraction of a day (0–1). Empty string = not filled in yet. */
  days: number | '';
}

export interface DayData {
  /** Note written as a grey row when the day has no entries (e.g. "Public holiday"). */
  holiday: string;
  records: EntryRecord[];
}

export interface MonthData {
  /** Keyed by ISO date, e.g. "2024-10-01". */
  days: Record<string, DayData>;
}

export type Months = Record<string, MonthData>;

export interface LeaveRow {
  label: string;
  category: string;
}

export interface CustomHoliday {
  date: string;
  name: string;
}

export interface Settings {
  staffName: string;
  titleLeft: string;
  titleRight: string;
  customers: string[];
  categories: string[];
  leaves: LeaveRow[];
  spareRows: number;
  includeWeekdays: boolean;
  useBotHolidays: boolean;
  botBangkok: boolean;
  customHolidays: CustomHoliday[];
}

export interface SheetRow {
  /** Date shown in column B (only on the first row of a day). */
  date: string | null;
  rec?: EntryRecord;
  holiday?: string;
}

export interface SummaryRow {
  name: string;
  days: number;
  leave: boolean;
}

export interface SheetData {
  rows: SheetRow[];
  total: number;
  summary: SummaryRow[];
}

export type ExportFormat = 'xlsx' | 'pdf';
export type View = 'day' | 'month';
