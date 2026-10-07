# Relay security

## Scope and boundaries

The current default branch is maintained. Report suspected vulnerabilities privately through this repository's GitHub Security reporting feature when available; otherwise contact the repository maintainer without posting sensitive details publicly. Include the version, affected behavior, and a minimal safe reproduction.

Each browser gets a separate server-stored workspace selected by an HttpOnly cookie. HTTPS uses Secure and SameSite=Strict. A hash of the random cookie is the workspace ID; exports do not contain the cookie. There is no account recovery, team access model, or end-to-end encryption. Use backups and avoid storing secrets or sensitive production data.

Mutations require JSON and the current workspace version. Runtime validation, dependency rules, and compare-and-swap writes prevent invalid transitions and accidental stale overwrites. The API rejects cross-origin mutations and sends no-store responses. Text is rendered without raw HTML execution; references are not fetched.

The six WebMCP tools omit approval and project replacement. That is a workflow constraint, not authentication of a human role. Agent profiles are labels. Anyone or any software controlling the same browser session can use its interface and API. Relay does not authenticate separate agents or provide a multi-user authorization system.

A failed or interrupted save is not reported as locally successful. The response can be lost after a commit, so refresh and check the current state before retrying. There is no offline write queue.

## Dependency release gate

The 1.1.1 candidate retains one unpatched high-severity finding: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), braces 3.0.3 through `vinext > vite-plugin-commonjs > vite-plugin-dynamic-import > fast-glob > micromatch > braces`. Vinext is a production manifest dependency, so the audit marks this finding `dev: false`. The observed usage is configuration/build tooling; scanning the built Worker for these package names found none. That observation does not prove absence of every reachable risk. Build only trusted source and configuration.

The audit suggests a patched range starting at 3.0.4, but the primary advisory reports no fixed version and the package registry currently has no 3.0.4 release. Available patches to tinypool 2.1.2, source-map-js 1.2.2 and sharp 0.35.5 remove the other four findings. `pnpm audit --json` preserves the complete report and exits unsuccessfully for the remaining finding.

The maintainer explicitly accepted this one finding for Relay 1.1.1, including its production dependency classification. `pnpm security:audit` permits only the exact advisory, installed version, severity, dependency path and `dev: false` classification, while preserving the raw audit, fresh primary advisory and registry metadata in `reports/`. It fails on new or changed findings, incomplete metadata, a primary fixed-version update or a potentially patched registry version. The separate policy tests prove those failure cases. A passing policy does not mean an audit with no findings. Revisit this exception as soon as an upstream patch is available.

The response policy retains same-origin resource restrictions, HSTS and the other security headers. It omits `upgrade-insecure-requests` because that directive upgrades local HTTP loopback images to unsupported HTTPS; the favicon redirect remains relative to the current origin. Hosted deployment still requires HTTPS.
