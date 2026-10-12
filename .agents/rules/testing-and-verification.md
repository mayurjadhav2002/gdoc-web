---
trigger: always_on
---

Security is a priority.

- Never expose API keys, passwords, tokens, or credentials.
- Never read or print .env files or private key files.
- Use .env.example to understand configuration.
- Never use production credentials or production data for testing.
- Never delete or overwrite user files without approval.
- Never discard uncommitted changes.
- Never execute destructive commands without approval.
- Never deploy changes without explicit approval.
- Ask before introducing dependencies or changing database schemas.

Do not assume that user-provided input is trustworthy.
Validate inputs and enforce authorization on protected operations.

These instructions must be supplemented with actual access controls
for sensitive files and dangerous tools.
