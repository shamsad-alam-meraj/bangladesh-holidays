# Releasing

Releases are automated from the `main` branch with
[release-please](https://github.com/googleapis/release-please) and npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers) with **staged publishing**:
no npm token is stored anywhere, every version carries
[provenance](https://docs.npmjs.com/generating-provenance-statements), and nothing becomes
public until a maintainer approves it with 2FA.

## How a release happens

1. Changes are merged into `main` with [Conventional Commit](https://www.conventionalcommits.org/)
   messages (squash-merge PR titles count). The commit type decides the version bump:

   | Commit                                  | Example                                    | Bump  |
   | --------------------------------------- | ------------------------------------------ | ----- |
   | `fix:` / `fix(data):`                   | `fix(data): move Eid-ul-Fitr to 11 March`  | patch |
   | `feat:` / `feat(data):`                 | `feat(data): add 2028 government holidays` | minor |
   | `feat!:` or a `BREAKING CHANGE:` footer | `feat!: rename getDayInfo().reason values` | major |
   | `docs:`, `test:`, `ci:`, `chore:`, …    |                                            | none  |

2. The **Publish** workflow (`.github/workflows/publish.yml`) keeps a release PR named
   `chore(release): vX.Y.Z` up to date. It bumps `package.json`, `src/version.ts` and
   `.release-please-manifest.json`, and writes the `CHANGELOG.md` entry.
3. Before merging the release PR, check that:
   - CI is green.
   - The changelog reads well.
   - Any dataset changes bumped the dataset `version` and `lastUpdated`, cite a source, and have
     verification tests.
   - `data/calendars.json` coverage is current, including `checkedDate`. Re-check
     [bb.org.bd](https://www.bb.org.bd) for Bangladesh Bank lists.
4. Merging the release PR creates the `vX.Y.Z` tag and GitHub release. The workflow's
   **Stage on npm** job then runs every check (`npm run release:check`) and stages the package
   with `npm stage publish --provenance`.
5. **Approve the staged version** (requires 2FA), either on npmjs.com under the package's staged
   versions, or from a terminal:

   ```sh
   npm stage list bangladesh-holidays
   npm stage approve <stage-id>
   ```

   To discard it instead, run `npm stage reject <stage-id>`.

6. Verify with `npm view bangladesh-holidays version`. The npm page shows the provenance badge.

## One-time setup

1. **npm → package → Settings → Trusted Publisher → GitHub Actions**
   - Organization or user: `shamsad-alam-meraj`
   - Repository: `bangladesh-holidays`
   - Workflow filename: `publish.yml`
   - Environment name: `npm`
   - Leave "publish directly" unchecked, so the publisher can only stage.
2. **npm → package → Settings → Publishing access:** choose _Require two-factor authentication and
   disallow tokens_.
3. **GitHub → Settings → Environments → New environment `npm`**
   - Deployment branches and tags: _Selected branches and tags_ → add `main`.
   - Optional: add yourself as a required reviewer for an extra approval gate.
4. **GitHub → Settings → Actions → General → Workflow permissions:** enable _Allow GitHub Actions to
   create and approve pull requests_ (release-please needs this to open the release PR).
5. Optional: CI does not run on release PRs opened with the default token. To get CI checks on
   them, add a fine-grained personal access token (Contents + Pull requests: read/write on this
   repository) as the `RELEASE_PLEASE_TOKEN` repository secret.
6. Recommended: protect `main` (_Settings → Branches_) by requiring pull requests and the CI checks
   to pass.

## Troubleshooting

| Symptom (in the Publish workflow log)                                | Cause                                                       | Fix                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GitHub Actions is not permitted to create or approve pull requests` | Repository setting                                          | Settings → Actions → General → Workflow permissions → tick _Allow GitHub Actions to create and approve pull requests_ → Save (owner account), or add the `RELEASE_PLEASE_TOKEN` secret. Then re-run.                                            |
| `E401 Unable to authenticate` at "Stage release on npm"              | No trusted publisher matches this run                       | `npm trust list bangladesh-holidays` must show repository `shamsad-alam-meraj/bangladesh-holidays`, file `publish.yml`, environment `npm`, permission `stage publish`. Revoke wrong entries (`npm trust revoke bangladesh-holidays --id <id>`). |
| `Tag … does not match package.json version`                          | A tag was created by hand                                   | Delete the wrong tag, or release manually (below).                                                                                                                                                                                              |
| `… is already published on npm — nothing to do`                      | Re-run of a version that is live                            | Nothing to fix.                                                                                                                                                                                                                                 |
| CI fails on a release commit                                         | Check the failing step locally with `npm run release:check` | Fix with a `fix:` commit; the next release PR picks it up.                                                                                                                                                                                      |

**Retrying a release:** after fixing the cause, either use **Re-run failed jobs** on the failed run,
or go to **Actions → Publish → Run workflow** on `main` and enter the tag (for example `v1.0.2`).
Retries are safe: the job skips versions that are already on npm. A version whose tag points at
broken code cannot be fixed in place. Ship the fix as the next patch release instead; skipping a
version number is fine.

## Manual release (fallback)

If automation is unavailable, run this from an up-to-date `main` with a clean working tree:

```sh
npm version <patch|minor|major> --no-git-tag-version   # then set src/version.ts to match
npm login
npm publish            # runs `npm run release:check` first via prepublishOnly
git tag vX.Y.Z && git push origin vX.Y.Z
```

Afterwards, update `.release-please-manifest.json` to the new version so release-please continues
from there.
