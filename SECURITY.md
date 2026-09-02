# Relay security

Relay is a demonstration planning workspace. Do not enter secrets, credentials, regulated data, or private production material.

## Security boundaries

- WebMCP tools expose only two reads and four constrained agent writes.
- Human approval, rejection, clarification answers, reset, export, and project-finalization actions remain in the visible interface.
- Every mutation is runtime-validated, rejects unknown fields, applies the same shared domain rules as the UI, and emits an audit event.
- Approval-required work cannot be completed by an agent tool.
- User content is rendered as text; the project does not use `dangerouslySetInnerHTML`.
- No API key, user credential, or secret is required in the client.

## Reporting

Please report a suspected vulnerability privately to the repository maintainer rather than opening a public exploit issue. Include the affected version, reproduction steps, impact, and the smallest safe proof of concept.

## Supported version

The latest deployed Relay version and the default branch are supported during the OpenAI WebMCP Challenge evaluation period.

