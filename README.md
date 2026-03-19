# migration-sentinel

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Migration%20Sentinel-blue?logo=github)](https://github.com/marketplace/actions/migration-sentinel)

Stop risky database migrations before they break production.

`migration-sentinel` is a GitHub Action and CLI that flags high-cost migration mistakes in pull requests before they hit production.

It is intentionally narrow:

- It focuses on migration failures, table locks, and irreversible data loss.
- It works well as a lightweight guardrail in CI.
- It competes on specificity instead of trying to replace broad AI review tools.

## Why teams install it

- Catch destructive schema changes before merge
- Warn on `NOT NULL` changes that can fail on existing rows
- Flag non-concurrent index creation that can lock Postgres writes
- Create GitHub annotations directly on pull requests
- Start with a simple ruleset teams can actually trust

## What it catches

- Destructive `DROP TABLE`, `DROP COLUMN`, or `DROP INDEX`
- `NOT NULL` added without an obvious backfill or default
- Non-concurrent Postgres index creation
- Column type changes
- Rename operations
- Bulk `DELETE FROM` statements

## Install in GitHub Actions

```yaml
name: Migration checks

on:
  pull_request:

jobs:
  migration-sentinel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: toruyamad-alt/migration-sentinel@v0.1.1
        with:
          target: db/migrate
          output: github
          fail-on: high
```

Working demo repository:

- [migration-sentinel-demo](https://github.com/toruyamad-alt/migration-sentinel-demo)

## Example config

Create `.migration-sentinel.json` in your repository:

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

## Framework examples

Rails or plain SQL migrations:

```yaml
- uses: toruyamad-alt/migration-sentinel@v0.1.1
  with:
    target: db/migrate
    output: github
    fail-on: high
```

Prisma migrations:

```yaml
- uses: toruyamad-alt/migration-sentinel@v0.1.1
  with:
    target: prisma/migrations
    output: github
    fail-on: high
```

## Local CLI usage

```bash
npm install
npm run demo
```

Scan a target directory:

```bash
npm run check -- path/to/migrations
```

Override at runtime:

```bash
npm run check -- db/migrate --output json --fail-on medium
```

## Exit codes

- `0`: no findings
- `1`: medium-risk findings only
- `2`: at least one high-risk finding

## Example findings

```text
[HIGH] NOT NULL added without obvious backfill
  file: 202603190001_risky.sql:1
  rule: unsafe-not-null
  why:  Adding NOT NULL without a backfill or default can fail on existing rows during deploy.
```

## Best fit

- Rails monoliths with frequent migrations
- Prisma or SQL migration pipelines
- Small backend teams that want a fast safety net in CI
- Teams that do not want a heavyweight platform rollout yet

## Roadmap

- a GitHub Action that blocks unsafe migrations
- a GitHub App with team-level policy settings
- a VS Code extension for pre-PR checks
- a hosted dashboard with audit history

## Release checks

```bash
npm test
npm run pack:dry
```

## Packaging and launch notes

- `action.yml`: GitHub Action metadata
- `docs/pricing.md`: suggested pricing tiers
- `docs/marketplace-listing.md`: listing copy
- `docs/launch-playbook.md`: final steps requiring your accounts

## Project structure

- `src/index.ts`: CLI entrypoint
- `src/config.ts`: config and input parsing
- `src/rules.ts`: detection rules
- `fixtures/`: sample safe and unsafe migrations
