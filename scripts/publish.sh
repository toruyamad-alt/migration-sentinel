#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/publish.sh <github-repo-url-or-slug> [tag]"
  exit 1
fi

repo_input="$1"
tag="${2:-v0.1.0}"

repo_slug="$repo_input"
repo_slug="${repo_slug#https://github.com/}"
repo_slug="${repo_slug#git@github.com:}"
repo_slug="${repo_slug%.git}"

if [[ ! "$repo_slug" =~ ^[^/]+/[^/]+$ ]]; then
  echo "Expected GitHub repo slug like org/repo or a GitHub URL."
  exit 1
fi

https_repo="https://github.com/${repo_slug}"
git_repo="${https_repo}.git"

echo "Preparing release for ${repo_slug} with tag ${tag}"
node scripts/set-repo.mjs "${repo_slug}"
npm test
npm pack

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "${git_repo}"
else
  git remote add origin "${git_repo}"
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  git add package.json
  git -c user.name='Codex' -c user.email='codex@local' commit -m "Set repository metadata for ${repo_slug}"
fi

git push -u origin "$(git branch --show-current)"
git tag "${tag}"
git push origin "${tag}"

echo "Published source to ${https_repo}"
echo "Next: create a GitHub release if your workflow does not auto-run, then submit to GitHub Marketplace."
