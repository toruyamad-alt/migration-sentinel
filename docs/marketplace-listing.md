# GitHub Marketplace Listing Draft

## Name

Migration Sentinel

## Tagline

Stop risky database migrations before they break production.

## Short description

Migration Sentinel scans pull requests for dangerous schema changes such as destructive drops, unsafe `NOT NULL` additions, non-concurrent index creation, and bulk deletes.

## Ideal customer

- Small SaaS teams shipping Rails, Prisma, Laravel, or Node backends
- Engineering managers who want fewer migration-related incidents
- Teams that need a lightweight guardrail before introducing a heavier platform

## Core benefits

- Catches high-cost migration mistakes in CI
- Leaves line-level GitHub annotations on pull requests
- Starts with a narrow rule set that is easy to understand and trust
- Can grow into organization-specific policy enforcement

## Launch copy

Database migrations are one of the easiest ways to ship an outage. Migration Sentinel adds a focused safety net to your PR workflow by flagging destructive schema changes, unsafe nullability updates, locking index creation, and other rollout hazards before merge.

## Demo workflow

1. Install the GitHub Action
2. Point it at your migrations directory
3. Review annotations in the pull request
4. Upgrade for custom rules and organization-wide policy management
