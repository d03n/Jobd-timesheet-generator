# 0001. Import replaces only the dates the file lists

- **Status:** Proposed (ships with the multi-month feature)
- **Date:** 2026-10-30

## Context

Import used to keep only the month with the most entries in the file, and replaced that whole
month in the app. With multi-month support, a file can cover a cut-off period such as
21 Oct – 20 Nov. Replacing whole months would wipe 1–20 Oct and 21–30 Nov, which the file
says nothing about.

## Decision

Importing replaces exactly the dates the file lists, i.e. each row with a date, including
empty rows and holiday notes, in whatever months they fall. Every other day is left as it is.
The confirmation message gives the number of dates it will replace.

Replacing the whole span from the file's first date to its last was considered and rejected.
One mistyped date (e.g. 05/10/2025 in an Oct-2026 sheet), or a file with January and March
sheets, would silently wipe everything in between.

## Consequences

- Importing a cut-off file is safe for the days around it.
- Re-importing an "only days with entries" or "selected days" export doesn't clear the days
  it left out.
- **Change for single-month files:** import used to replace the whole month. Now a month's
  export (weekdays plus holidays) replaces those dates only, and weekend entries survive.
- If a date appears on several worksheets, only the first worksheet's rows are used.
