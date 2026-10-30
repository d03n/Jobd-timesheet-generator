# Multi-month timesheets

Timesheets can cover any date range, not just one calendar month. This supports cut-off
periods such as 21 October – 20 November.

## Export

In **Download**, choose **Period → Date range** and pick the *From* and *To* dates.

- The range must have both dates, end on or after its start, and be at most 366 days long.
  Otherwise Download and Preview stay disabled and the dialog explains why.
- **This month** works as before, including *Selected days only*. *Selected days* isn't
  offered for a date range.

### Layout

The Layout choice appears only when the range touches more than one month.

| Layout | Excel | PDF |
| --- | --- | --- |
| One sheet per month | One worksheet per calendar month in the range | Each month starts on a new page |
| One combined sheet | A single worksheet | A single section |

Each sheet or section has its own TOTAL and SUMMARY, and its own 100%. With *per month*,
21–31 Oct and 1–20 Nov are each 100% of themselves; with *combined*, the whole period is 100%.

With **Only days with entries**, months that have no entries in the range are left out
instead of producing an empty sheet.

### Names

| Range | Worksheet | File |
| --- | --- | --- |
| 1–31 Oct 2026 (whole month) | `JobD-Oct-2026` | `Name_Job-D_Oct_2026.xlsx` |
| 21–31 Oct 2026 (part of a month) | `JobD-21-31Oct-2026` | `Name_Job-D_21Oct2026-31Oct2026.xlsx` |
| 21 Oct – 20 Nov 2026 | `JobD-21Oct-20Nov-2026` | `Name_Job-D_21Oct2026-20Nov2026.xlsx` |
| 21 Dec 2026 – 20 Jan 2027 | `JobD-21Dec2026-20Jan2027` | `Name_Job-D_21Dec2026-20Jan2027.xlsx` |

Worksheet names stay within Excel's 31-character limit.

## Import

Import reads **every visible worksheet** that has a "Job Description" header row, and keeps
every date it finds, across any number of months. Files exported with either layout import
back to the same entries. If a date appears on more than one worksheet, the first worksheet
wins, so overlapping sheets don't double entries.

Importing **replaces only the dates the file lists**: each date row, including empty rows and
holiday notes. Every other day is kept, even one between the file's first and last date.
After importing, the calendar shows the month with the most dates in the file. See
[decision 0001](../decisions/0001-import-replaces-file-range.md).

## Code

| Where | What |
| --- | --- |
| `src/lib/sheet.ts` | `Period`, `periodMonths`, `splitByMonth`, `mergeMonths`, `exportParts`, labels and names |
| `src/lib/workbook.ts` | `buildPartsWorkbook`: one worksheet per part |
| `src/lib/pdf.ts` | `buildPartsPdf`: one section per part |
| `src/lib/importer.ts` | Reads all worksheets; returns the listed `days`, their `period` and main month |
| `src/state/store.tsx` | `replaceDays`: overwrites exactly the given dates, in any month |
| `src/components/ExportDialog.tsx` | Period, Layout and Days-to-include controls |
