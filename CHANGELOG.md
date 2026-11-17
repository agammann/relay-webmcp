# Changes

## 1.1.4

- Publish the current dependency and Node 24/26 CI changes in a matching source release; prior source archives remain immutable.
- Update Vite 8.2.4 to 8.3.7 with patched Rolldown for [GHSA-p4f5-76q4-ffq7](https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7). The affected condition is an explicitly network-exposed development server, separate from the deployed production Worker.
- Disable framework ISR for the generic entry document and require private revalidation for its HTML and RSC variants, keeping workspace API responses no-store and static asset policies unchanged.
- Add repeated production-Worker GET/HEAD/RSC, referenced JS/CSS byte/MIME and missing-asset regression checks. Retain real native lifecycle and local back-forward-cache requirements.
- Separate idle prerequisite disablement from an active save: blocked completion, assignment and submission forms keep their action labels instead of incorrectly showing “Saving…”. Disabled controls and task rules remain in force; add a real-Worker dependent-task regression.
- Preserve D1 data, cookie-selected browser identity, task/review rules, backup format and six tools. No database migration or agent-launching integration is introduced.

## 1.1.3

- Bound incoming workspace JSON while reading its bytes, including streamed requests without a declared size.
- Keep the existing 1 MB request ceiling, 900 KB saved-workspace ceiling, session checks, and backup format.

## 1.1.2

- Replace the unbounded brace dependency with a maintained compatibility package that preserves ordinary glob behavior and the upstream license.
- Reject excessive brace, parenthesis and AST-array nesting before stack exhaustion.
- Require dependency audits without accepted advisories and verify the replacement in freshly installed source distributions.

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
