# Job-D timesheet builder

Log your daily work on a calendar and export the Silverlake **Job-D time sheet** to
**Excel (with live formulas)** or **PDF**.

Built with React 18, TypeScript (strict) and Vite. Everything runs in the browser;
entries are saved in the browser's local storage.

## Features

- **Calendar** — pick a day, or select several (Ctrl/⌘-click, Shift-click for a weekday
  range, "Working days", "Empty working days"). Arrow keys move between days.
- **Entries** — job description, IR/CR Ref#, category and customer dropdowns, days, and
  utilization. Edit as cards or in a table (the table becomes stacked cards on phones).
- **Utilization** — 100% is always the days you're looking at: the open day, the selected
  days, or the whole month.
- **Copy / paste** entries between days, add the same entry to many days, copy the previous day.
- **Multi-delete and clear month**, each with Undo.
- **Bank of Thailand holidays** for 2026–2027 built in, plus your own custom holidays.
- **Import** an existing Job-D `.xlsx`.
- **Export** the whole month, only days with entries, or the selected days:
  - **Excel**: `% of Utilization = G/TOTAL`, `TOTAL = SUM`, customer rows use `SUMIF` minus
    leave `SUMIFS`, leave rows use `SUMIF` on category, Category/Customer cells have dropdowns,
    and the category list is hidden below the summary.
  - **PDF**: same layout and numbers.
- **Settings** — staff name, title, customers, categories, leave rows, holidays, blank rows.
- Accessible: 44px touch targets, keyboard navigation, focus-trapped dialogs, light/dark themes.

## Getting started

Requires Node.js 18 or later.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server                           |
| `npm run build`     | Type-check and build to `dist/`                |
| `npm run preview`   | Serve the production build locally             |
| `npm run typecheck` | Type-check only                                |
| `npm test`          | Run unit tests (Vitest)                        |

`dist/` is a static site (relative paths), so it can be hosted anywhere — GitHub Pages,
Netlify, an internal web server, or opened from a shared folder via a local server.

## Project structure

```
src/
  types.ts                 Shared data types
  App.tsx                  Layout and export flow
  state/
    store.tsx              App state (React context), persistence, selection, undo helpers
    actions.ts             Copy/paste, add, delete, clear-with-undo actions
  lib/
    workbook.ts            Excel generator (ExcelJS) with live formulas
    pdf.ts                 PDF generator (jsPDF + autotable)
    importer.ts            Reads an existing Job-D .xlsx
    sheet.ts               Row/summary calculations shared by UI and exports
    holidays.ts            Bank of Thailand holiday table
    storage.ts             Defaults, validation, localStorage
    dates.ts, exporter.ts, download.ts, ids.ts
    __tests__/             Unit tests
  components/              Header, Calendar, Summary, Editor, Day/Multi/Table views,
                           Settings/Export/Confirm dialogs, Modal, Toast, icons
legacy/
  jobd-timesheet.html      The original single-file version, kept for reference
```

## Updating holidays

The Bank of Thailand announces the next year's financial institutions' holidays around
August. Add the dates to `BOT_HOLIDAYS` in `src/lib/holidays.ts` (and its `sources` entry).
Source: <https://www.bot.or.th/en/financial-institutions-holiday.html>

## Data and privacy

Entries and settings are stored only in the browser (`localStorage`, key
`jobd-timesheet:v1`). Clearing site data removes them, so export your timesheets regularly.
