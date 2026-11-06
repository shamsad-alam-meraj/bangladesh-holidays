# Contributing to bangladesh-holidays

Thank you for helping! Data corrections, new years' datasets, bug fixes and documentation
improvements are all welcome.

## Ground rules for holiday data

Correctness matters more than completeness — people use this library for payroll and legal deadlines.

1. **Official sources only.** Government holidays come from the Ministry of Public Administration
   notification ([mopa.gov.bd](https://mopa.gov.bd)); bank holidays from Bangladesh Bank circulars
   ([bb.org.bd](https://www.bb.org.bd)). News reports may help you find a notice but are not a source.
2. **Never invent or estimate dates in an `official` dataset.** If something cannot be verified,
   leave it out and record the calendar/year as `unavailable` in `data/calendars.json`, with a
   `reason` and `checkedDate`.
3. **Keep the notice's structure.** Keep general (সাধারণ) and executive-order (নির্বাহী আদেশে)
   holidays separate. Record the `notice` section, serial and printed Bangla dates. Mark every entry
   the notice flags with an asterisk (moon sighting / lunar tithi) as `"dateStatus": "tentative"`.
4. **Moon-sighting confirmations and in-year changes** (e.g. a separate notice adding a holiday) need
   their own source. Update the record (`"dateStatus": "confirmed"`, with the new `source`), bump the
   dataset `version` and add a CHANGELOG entry.
5. **Bangla names are verbatim** from the notice. English names are conventional translations.

### Adding or updating a dataset

1. Create or edit `data/<calendar>/<year>.json` (see `schema/holiday-dataset.schema.json`;
   editors that understand `$schema` will validate as you type).
2. Register new files in `src/data/index.ts` and `data/calendars.json`.
3. Add verification tests. For government data, follow `tests/data.test.ts`: transcribe the
   printed weekday of each row and the per-section totals _independently_ from the PDF, and let the
   tests check them against the dataset and the Bangla calendar converter.
4. Run `npm run release:check`.
5. In the PR, link the source document and say how you verified each row.

Use `getHolidayChanges(oldDataset, newDataset)` to produce a reviewable diff for data PRs.

## Development

Requirements: Node.js 22.12+ and npm.

```sh
npm install
npm run typecheck      # tsc, strict mode
npm run lint           # ESLint (type-aware) + Prettier check
npm test               # Vitest
npm run test:coverage  # with coverage thresholds
npm run build          # tsup → dist (ESM, CJS, .d.ts)
npm run examples       # run examples/ against the build
npm run smoke          # pack, install and verify ESM/CJS/TS/browser consumers
npm run release:check  # all of the above
```

Code guidelines:

- Zero runtime dependencies. Library code must run in browsers, so don't use Node.js APIs in `src/`.
- `src/` targets ES2020 (`lib: ["ES2020"]`); avoid newer built-ins such as `Array.prototype.at`.
- Dates are ISO `YYYY-MM-DD` strings; do arithmetic with the helpers in `src/core/date-utils.ts`,
  never with local-time `Date` methods.
- Public return values are frozen. Never mutate caller input.
- Every behavior change needs tests. Realistic scenario tests are encouraged.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/). Commit messages (or squash-merge
  PR titles) drive versioning and the changelog through release-please (see
  [RELEASING.md](RELEASING.md)):
  - `fix:` → patch release; use `fix(data):` for holiday data corrections
  - `feat:` → minor release; use `feat(data):` for a new year or calendar
  - `feat!:` or a `BREAKING CHANGE:` footer → major release
  - `docs:`, `test:`, `refactor:`, `build:`, `ci:`, `chore:` → no release
- Keep PRs focused, and fill in the pull request template.
- Don't edit `CHANGELOG.md` or version numbers by hand; release-please generates them.

## Reporting issues

- Wrong or missing holiday → open a **Holiday data correction** issue with a link to the official source.
- Bugs and feature requests → use the corresponding issue templates.
- Security issues → see [SECURITY.md](SECURITY.md); please don't open a public issue.
