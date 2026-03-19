import { readFile, writeFile } from "node:fs/promises";

const input = process.argv[2];

if (!input) {
  console.error("Usage: node scripts/set-repo.mjs <github-repo-url-or-slug>");
  process.exit(1);
}

const toHttpsRepoUrl = (value) => {
  if (value.startsWith("https://github.com/")) {
    return value.replace(/\.git$/, "");
  }

  if (value.startsWith("git@github.com:")) {
    return `https://github.com/${value.slice("git@github.com:".length).replace(/\.git$/, "")}`;
  }

  if (/^[^/]+\/[^/]+$/.test(value)) {
    return `https://github.com/${value}`;
  }

  throw new Error("Expected GitHub repo slug like org/repo or URL like https://github.com/org/repo");
};

const repoUrl = toHttpsRepoUrl(input);
const packageJsonPath = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

packageJson.homepage = repoUrl;
packageJson.repository = {
  type: "git",
  url: `git+${repoUrl}.git`,
};
packageJson.bugs = {
  url: `${repoUrl}/issues`,
};

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Updated package.json repository metadata to ${repoUrl}`);
