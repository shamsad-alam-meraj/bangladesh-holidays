# Release checklist

Releases follow [Semantic Versioning](https://semver.org/):

- **patch** — bug fixes, data corrections and moon-sighting confirmations within an existing year
- **minor** — new features, new years' datasets, new calendars
- **major** — breaking API changes

## Steps

1. [ ] `main` is green in CI.
2. [ ] Data: every dataset changed since the last release has a bumped `version`, an updated
       `lastUpdated`, a cited `source`, and verification tests. `calendars.json` coverage is current,
       including `checkedDate` for unavailable calendars (re-check bb.org.bd for Bangladesh Bank lists).
3. [ ] Move the **Unreleased** entries in `CHANGELOG.md` under the new version and date.
4. [ ] Bump the version: `npm version <patch|minor|major> --no-git-tag-version`, then update
       `src/version.ts` to match (a test enforces this).
5. [ ] `npm run release:check` passes locally.
6. [ ] Inspect the package contents: `npm pack --dry-run`.
7. [ ] Commit `chore(release): vX.Y.Z`, tag `vX.Y.Z`, and push the commit and tag.
8. [ ] Create a GitHub release from the tag, using the CHANGELOG section as notes. Publishing the
       release triggers `.github/workflows/release.yml`, which runs the checks and publishes to npm
       with provenance.
9. [ ] Verify on npm: `npm view bangladesh-holidays version` and install it in a scratch project.

## npm publishing setup (one time)

Either:

- **Trusted publishing (recommended):** on npmjs.com → package settings → _Trusted Publisher_, add
  GitHub Actions with repository `shamsad-alam-meraj/bangladesh-holidays` and workflow `release.yml`.
  No token is needed.
- **Token:** create an npm _granular access token_ with publish rights and save it as the
  `NPM_TOKEN` repository secret.

For the very first publish you can also publish manually:

```sh
npm login
npm run release:check
npm publish --access public
```
