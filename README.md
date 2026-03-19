# migration-sentinel

`migration-sentinel` is a small CLI and GitHub Action that flags risky database migration patterns before they reach production.

This is intentionally shaped like a sellable niche tool:

- It targets a painful, expensive failure mode.
- It works locally and can be wrapped as a GitHub Action or Marketplace product.
- It is narrow enough to compete with broad AI code review tools.

## What it catches

- Destructive `DROP TABLE`, `DROP COLUMN`, or `DROP INDEX`
- `NOT NULL` added without an obvious backfill or default
- Non-concurrent Postgres index creation
- Column type changes
- Rename operations
- Bulk `DELETE FROM` statements

## Quick start

```bash
npm install
npm run demo
```

Scan a target directory:

```bash
npm run check -- path/to/migrations
```

Use the config file in the project root:

```json
{
  "target": "db/migrate",
  "output": "github",
  "failOn": "high",
  "disabledRules": [],
  "include": ["**/*.sql", "**/*.rb"],
  "exclude": ["**/safe/**", "**/schema.prisma"]
}
```

Override at runtime:

```bash
npm run check -- db/migrate --output json --fail-on medium
```

## GitHub Action

```yaml
name: Migration checks

on:
  pull_request:

jobs:
  migration-sentinel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/migration-sentinel@v0.1.0
        with:
          target: db/migrate
          output: github
          fail-on: high
```

## Release checks

```bash
npm test
npm run pack:dry
```

Exit codes:

- `0`: no findings
- `1`: medium-risk findings only
- `2`: at least one high-risk finding

## Why this is monetizable

Generic AI review already exists. A safer wedge is a tool that prevents specific release accidents:

- migration failures
- table locks
- irreversible data loss
- schema changes that break rolling deploys

This prototype can grow into:

- a GitHub Action that blocks unsafe migrations
- a GitHub App with team-level policy settings
- a VS Code extension for pre-PR checks
- a hosted dashboard with audit history

## Packaging for sale

- [`action.yml`](/Users/ty/Desktop/brain/action.yml): GitHub Action metadata
- [`docs/pricing.md`](/Users/ty/Desktop/brain/docs/pricing.md): suggested pricing tiers
- [`docs/marketplace-listing.md`](/Users/ty/Desktop/brain/docs/marketplace-listing.md): listing copy
- [`docs/launch-playbook.md`](/Users/ty/Desktop/brain/docs/launch-playbook.md): final steps requiring your accounts

## Project structure

- `src/index.ts`: CLI entrypoint
- `src/config.ts`: config and input parsing
- `src/rules.ts`: detection rules
- `fixtures/`: sample safe and unsafe migrations
