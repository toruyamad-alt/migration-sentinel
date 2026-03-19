import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { rules } from "./rules.js";
const DEFAULT_CONFIG_PATH = ".migration-sentinel.json";
const DEFAULT_CONFIG = {
    target: "migrations",
    output: "text",
    failOn: "high",
    disabledRules: [],
    include: [],
    exclude: ["**/schema.prisma"],
};
const validOutputs = new Set(["text", "json", "github"]);
const validFailOn = new Set(["none", "medium", "high"]);
const validRules = new Set(rules.map((rule) => rule.id));
const toEnvName = (name) => `MIGRATION_SENTINEL_${name.replace(/-/g, "_").toUpperCase()}`;
const readEnv = (name) => process.env[toEnvName(name)] ?? process.env[`INPUT_${name.replace(/-/g, "_").toUpperCase()}`];
const normalizeStringArray = (value, fieldName) => {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        throw new Error(`${fieldName} must be an array of strings`);
    }
    return value;
};
const validateOutput = (value) => {
    if (typeof value !== "string" || !validOutputs.has(value)) {
        throw new Error(`output must be one of: ${Array.from(validOutputs).join(", ")}`);
    }
    return value;
};
const validateFailOn = (value) => {
    if (typeof value !== "string" || !validFailOn.has(value)) {
        throw new Error(`failOn must be one of: ${Array.from(validFailOn).join(", ")}`);
    }
    return value;
};
const validateDisabledRules = (disabledRules) => {
    const invalid = disabledRules.filter((ruleId) => !validRules.has(ruleId));
    if (invalid.length > 0) {
        throw new Error(`disabledRules contains unknown rule ids: ${invalid.join(", ")}`);
    }
    return disabledRules;
};
const parseList = (value) => value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
const parseCliArgs = (argv) => {
    let target;
    let configPath;
    let output;
    let failOn;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (!arg.startsWith("--")) {
            target ??= arg;
            continue;
        }
        const next = argv[index + 1];
        if (arg === "--config") {
            if (!next) {
                throw new Error("--config requires a path");
            }
            configPath = next;
            index += 1;
            continue;
        }
        if (arg === "--output") {
            output = validateOutput(next);
            index += 1;
            continue;
        }
        if (arg === "--fail-on") {
            failOn = validateFailOn(next);
            index += 1;
            continue;
        }
        if (arg === "--help") {
            printHelp();
            process.exit(0);
        }
        throw new Error(`Unknown argument: ${arg}`);
    }
    return { target, configPath, output, failOn };
};
const loadConfigFile = async (configPath) => {
    const fileContents = await readFile(configPath, "utf8");
    const parsed = JSON.parse(fileContents);
    return parsed;
};
const configExists = async (configPath) => {
    try {
        await access(configPath);
        return true;
    }
    catch {
        return false;
    }
};
export const printHelp = () => {
    console.log(`migration-sentinel

Usage:
  migration-sentinel [target] [--config path] [--output text|json|github] [--fail-on none|medium|high]

Environment variables:
  MIGRATION_SENTINEL_TARGET
  MIGRATION_SENTINEL_OUTPUT
  MIGRATION_SENTINEL_FAIL_ON
  MIGRATION_SENTINEL_DISABLED_RULES     comma-separated rule ids
  MIGRATION_SENTINEL_INCLUDE            comma-separated glob patterns
  MIGRATION_SENTINEL_EXCLUDE            comma-separated glob patterns

GitHub Action inputs:
  target, output, fail-on, config
`);
};
export const loadAppConfig = async (argv) => {
    const cli = parseCliArgs(argv);
    const configPath = path.resolve(process.cwd(), cli.configPath ?? readEnv("config") ?? DEFAULT_CONFIG_PATH);
    const hasConfig = await configExists(configPath);
    const fileConfig = hasConfig ? await loadConfigFile(configPath) : {};
    const merged = {
        target: cli.target ??
            readEnv("target") ??
            fileConfig.target ??
            DEFAULT_CONFIG.target,
        output: cli.output ??
            (readEnv("output") ? validateOutput(readEnv("output")) : undefined) ??
            (fileConfig.output ? validateOutput(fileConfig.output) : undefined) ??
            DEFAULT_CONFIG.output,
        failOn: cli.failOn ??
            (readEnv("fail-on") ? validateFailOn(readEnv("fail-on")) : undefined) ??
            (fileConfig.failOn ? validateFailOn(fileConfig.failOn) : undefined) ??
            DEFAULT_CONFIG.failOn,
        disabledRules: validateDisabledRules([
            ...DEFAULT_CONFIG.disabledRules,
            ...normalizeStringArray(fileConfig.disabledRules, "disabledRules"),
            ...parseList(readEnv("disabled-rules")),
        ]),
        include: [
            ...DEFAULT_CONFIG.include,
            ...normalizeStringArray(fileConfig.include, "include"),
            ...parseList(readEnv("include")),
        ],
        exclude: [
            ...DEFAULT_CONFIG.exclude,
            ...normalizeStringArray(fileConfig.exclude, "exclude"),
            ...parseList(readEnv("exclude")),
        ],
    };
    return merged;
};
