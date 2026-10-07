# Changes

## 1.1.1

- Retain available patches for tinypool 2.1.2, source-map-js 1.2.2 and sharp 0.35.5.
- Keep the built Worker's local D1 data under the repository's `.wrangler/state`
  directory, outside rebuild output. Earlier `pnpm start` instances used
  `dist/server/.wrangler/state`; export that work before changing local storage.
- Document v1 workflow, browser-session recovery, upgrades and measured Chrome
  155 native tool behavior without changing task, cookie or backup formats.
- Add checksum-verified, clean-tree source packaging and fresh-folder extraction.
- Keep the favicon on the current origin and preserve HTTP loopback images without
  changing the same-origin CSP restrictions or hosted HTTPS requirement.

## 1.1.0 source baseline

- Separate browser workspaces stored in D1, task packets, dependencies, reviewed
  deliverables, clarification history, manual controls and six page-side tools.
- Validated JSON backups and versioned writes that refuse stale edits.
