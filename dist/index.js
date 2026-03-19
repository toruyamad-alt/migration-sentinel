#!/usr/bin/env node
import { appendFile, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadAppConfig } from "./config.js";
import { runRules, supportedExtensions, } from "./rules.js";
const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+?.*]/g, "\\$&");
const globToRegex = (pattern) => {
    const doubleStarToken = "__DOUBLE_STAR__";
    const singleStarToken = "__SINGLE_STAR__";
    const escaped = escapeRegex(pattern
        .replace(/\*\*/g, doubleStarToken)
        .replace(/\*/g, singleStarToken))
        .replace(new RegExp(doubleStarToken, "g"), ".*")
        .replace(new RegExp(singleStarToken, "g"), "[^/]*");
    return new RegExp(`^${escaped}$`);
};
const walk = async (entryPath) => {
    const entryStat = await stat(entryPath);
    if (entryStat.isFile()) {
        return [entryPath];
    }
    const children = await readdir(entryPath, { withFileTypes: true });
    const nested = await Promise.all(children.map((child) => walk(path.join(entryPath, child.name))));
    return nested.flat();
};
const isSupportedFile = (filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()) ||
    filePath.endsWith("schema.prisma");
const matchesPatterns = (filePath, rootDir, patterns) => {
    if (patterns.length === 0) {
        return true;
    }
    const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/");
    return patterns.some((pattern) => globToRegex(pattern).test(relativePath));
};
const scanFile = async (filePath) => {
    const text = await readFile(filePath, "utf8");
    const lines = text.split(/\r?\n/);
    return runRules({
        filePath,
        lines,
        text,
    });
};
const getRelativePath = (rootDir, filePath) => path.relative(rootDir, filePath) || path.basename(filePath);
const shouldFail = (findings, failOn) => {
    if (failOn === "none") {
        return 0;
    }
    if (failOn === "medium" && findings.length > 0) {
        return 1;
    }
    if (failOn === "high" && findings.some((finding) => finding.severity === "high")) {
        return 2;
    }
    return 0;
};
const printTextOutput = (findings, rootDir) => {
    if (findings.length === 0) {
        console.log(`No risky migration patterns found in ${rootDir}`);
        return;
    }
    console.log(`Found ${findings.length} migration risk(s) in ${rootDir}\n`);
    for (const finding of findings) {
        const relativePath = getRelativePath(rootDir, finding.filePath);
        console.log(`[${finding.severity.toUpperCase()}] ${finding.title}\n` +
            `  file: ${relativePath}:${finding.line}\n` +
            `  rule: ${finding.ruleId}\n` +
            `  why:  ${finding.detail}\n`);
    }
};
const printJsonOutput = (findings, rootDir) => {
    const payload = {
        rootDir,
        count: findings.length,
        findings: findings.map((finding) => ({
            ...finding,
            relativePath: getRelativePath(rootDir, finding.filePath),
        })),
    };
    console.log(JSON.stringify(payload, null, 2));
};
const appendGithubSummary = async (findings, rootDir) => {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
        return;
    }
    const lines = findings.length === 0
        ? [`## Migration Sentinel`, "", `No risky migration patterns found in \`${rootDir}\`.`]
        : [
            `## Migration Sentinel`,
            "",
            `Found **${findings.length}** migration risk(s) in \`${rootDir}\`.`,
            "",
            "| Severity | Rule | File | Why |",
            "| --- | --- | --- | --- |",
            ...findings.map((finding) => `| ${finding.severity} | ${finding.ruleId} | \`${getRelativePath(rootDir, finding.filePath)}:${finding.line}\` | ${finding.detail} |`),
        ];
    await appendFile(summaryPath, `${lines.join("\n")}\n`);
};
const setGithubOutputs = async (findings) => {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) {
        return;
    }
    const highCount = findings.filter((finding) => finding.severity === "high").length;
    const mediumCount = findings.length - highCount;
    const lines = [
        `finding-count=${findings.length}`,
        `high-count=${highCount}`,
        `medium-count=${mediumCount}`,
    ];
    await appendFile(outputPath, `${lines.join("\n")}\n`);
};
const printGithubOutput = async (findings, rootDir) => {
    if (findings.length === 0) {
        console.log(`Migration Sentinel: no risky migration patterns found in ${rootDir}`);
    }
    for (const finding of findings) {
        const relativePath = getRelativePath(rootDir, finding.filePath);
        const level = finding.severity === "high" ? "error" : "warning";
        const message = `${finding.title}. ${finding.detail}`;
        console.log(`::${level} file=${relativePath},line=${finding.line},title=${finding.ruleId}::${message}`);
    }
    await appendGithubSummary(findings, rootDir);
    await setGithubOutputs(findings);
};
const printFindings = async (findings, rootDir, output) => {
    if (output === "json") {
        printJsonOutput(findings, rootDir);
        return;
    }
    if (output === "github") {
        await printGithubOutput(findings, rootDir);
        return;
    }
    printTextOutput(findings, rootDir);
};
const main = async () => {
    try {
        const config = await loadAppConfig(process.argv.slice(2));
        const targetDir = path.resolve(process.cwd(), config.target);
        const allFiles = (await walk(targetDir))
            .filter(isSupportedFile)
            .filter((filePath) => matchesPatterns(filePath, targetDir, config.include))
            .filter((filePath) => !matchesPatterns(filePath, targetDir, config.exclude))
            .sort();
        const findings = (await Promise.all(allFiles.map((filePath) => scanFile(filePath))))
            .flat()
            .filter((finding) => !config.disabledRules.includes(finding.ruleId));
        await printFindings(findings, targetDir, config.output);
        process.exitCode = shouldFail(findings, config.failOn);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`migration-sentinel failed: ${message}`);
        process.exitCode = 1;
    }
};
void main();
