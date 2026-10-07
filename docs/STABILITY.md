# Relay v1 scope and recovery

The supported core workflow is a saved project and complete task packet, manual
assignment or page-tool claim, recorded progress and clarification answers,
deliverable submission, revision, resubmission, human approval, reload and JSON
backup restore. Relay stores this work in a server-side D1 workspace selected by
the browser's HttpOnly cookie. It records assignments and review decisions; a
person or a connected agent performs the work with its own tools.

Within v1, the six documented tool names and validated argument contracts remain
supported. Existing workspace JSON exports remain readable. This candidate
introduces no D1, cookie or export migration. Review requirements are workflow
rules; agent profile names are not authenticated identities. No API key, model
download, background agent launcher, team sharing or offline write queue is
provided.

Ordinary controls work without WebMCP. Native discovery is experimental and must
be measured separately from a registration harness. Chrome 155 uses object
arguments; earlier Chrome/Edge 154 checks used serialized arguments. A browser
must expose the native API and an assistant must support discovering page tools.
Local native browser checks do not establish compatibility with every assistant.

Export a JSON backup before replacing a project, clearing cookies, changing
browser profiles or upgrading a deployment. Keep the original origin, D1
binding and database during deployment updates. Stop Wrangler before rebuilding
on Windows; `.wrangler/` is local runtime data, not a production database. A
different browser identity gets a separate workspace. Import keeps that
destination identity and replaces its current project only after confirmation.

The built Worker's `pnpm start` now explicitly stores local data at
`.wrangler/state`, outside `dist/`. If you have work from the earlier local start
command, export it before upgrading or rebuilding: its default data location was
`dist/server/.wrangler/state`. Import that backup after starting the new command.
There is no automatic local database move, and production D1 is unaffected.

For an interrupted save, refresh and inspect the saved work before retrying; the
response may be lost after a commit. A stale edit must be retried against the
latest state. A rejected import must preserve the current project: keep the
backup, correct its references or structure, and retry. There is no account
recovery if both the cookie and backups are lost. Removing source files does
not delete server-stored work; preserve exports before removing a deployment.

## Source delivery

The 1.1.1 patch candidate updates available dependency fixes and adds source
archive verification. Its full audit still reports one unpatched high-severity
finding; [Security](../SECURITY.md) records the maintainer's exact exception and
the fail-closed release policy. It is not an audit with no findings. The main-only
publisher releases only the checked source archive and its verified digests after
the workflow gates pass; the hosted deployment has a separate acceptance check.

A maintainer can inspect a clean committed source package locally:

```sh
pnpm package:release
python scripts/unpack-release.py --out ../relay-clean-consumer
pnpm --dir ../relay-clean-consumer install --frozen-lockfile
pnpm --dir ../relay-clean-consumer build
pnpm --dir ../relay-clean-consumer start --port 3013
```

Packaging includes only tracked source, README, MIT license and frozen lockfile,
with SHA-256 sidecars. It refuses a dirty tree. The Python 3.12+ verification
helper rejects unsafe ZIP paths, extra/missing files, private/runtime files,
checksum differences or bytes that differ from the committed checkout. It writes
to a new folder outside the source. The archive is source and needs the pinned
Node/pnpm toolchain and dependencies; it is not a prebuilt offline executable.

For an approved future tagged release, use the source archive and SHA256SUMS
from that release together, verify the digest before extraction, and retain the
version and commit when reporting a problem. Do not treat a current default
branch download or an older successful CI run as verification of a later patch.
