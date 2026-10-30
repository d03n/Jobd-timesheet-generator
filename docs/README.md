# Project documentation

Documents about the Job-D timesheet builder that don't fit in the code or the top-level
[README](../README.md). The README covers what the app does and how to run it; this folder
covers how it's deployed, how features are meant to behave, and why things are the way they are.

## Contents

| Document | What it covers |
| --- | --- |
| [deployment.md](deployment.md) | Building and deploying to Cloudflare, Node/Vite requirements, known build pitfalls |
| [features/multi-month.md](features/multi-month.md) | Date-range export (per-month or combined) and multi-month import |
| [decisions/](decisions/) | Design decisions and the reasons behind them |

## Where things go

- **`features/`**: how a feature behaves, from the user's side: rules, edge cases, examples.
  Write one when a feature has behaviour that isn't obvious from the UI.
- **`decisions/`**: one file per decision, named `NNNN-short-title.md` (e.g.
  `0001-import-replaces-file-range.md`). Use [the template](decisions/0000-template.md). Don't
  edit a decision after it's made. If it changes, add a new one and mark the old one *Superseded*.
- **Top level**: guides that apply to the whole project (deployment, release process, and so on).

When you add a document, add a row to the table above.
