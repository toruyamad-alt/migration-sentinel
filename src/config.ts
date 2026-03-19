import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { rules, type FailOn, type OutputFormat } from "./rules.js";

export type AppConfig = {
  target: string;
  output: OutputFormat;
  failOn: FailOn;
  disabledRules: string[];
  include: string[];
  exclude: string[];
};

type ConfigFile = Partial<Omit<AppConfig, "target">> & {
  target?: string;
};

const DEFAULT_CONFIG_PATH = ".migration-sentinel.json";
const DEFAULT_CONFIG: AppConfig = {
  target: "migrations",
  output: "text",
  failOn: "high",
  disabledRules: [],
  include: [],
  exclude: ["**/schema.prisma"],
};

const validOutputs = new Set<OutputFormat>(["text", "json", "github"]);
const validFailOn = new Set<FailOn>(["none", "medium", "high"]);
const validRules = new Set(rules.map((rule) => rule.id));

const toEnvName = (name: string): string =>
  `MIGRATION_SENTINEL_${name.replace(/-/g, "_").toUpperCase()}`;

const readEnv = (name: string): string | undefined =>
  process.env[toEnvName(name)] ?? process.env[`INPUT_${name.replace(/-/g, "_").toUpperCase()}`];

const normalizeStringArray = (value: unknown, fieldName: string): string[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be an array of strings`);
  }

  return value;
};

const validateOutput = (value: unknown): OutputFormat => {
  if (typeof value !== "string" || !validOutputs.has(value as OutputFormat)) {
    throw new Error(`output must be one of: ${Array.from(validOutputs).join(", ")}`);
  }

  return value as OutputFormat;
};

const validateFailOn = (value: unknown): FailOn => {
  if (typeof value !== "string" || !validFailOn.has(value as FailOn)) {
    throw new Error(`failOn must be one of: ${Array.from(validFailOn).join(", ")}`);
  }

  return value as FailOn;
};

const validateDisabledRules = (disabledRules: string[]): string[] => {
  const invalid = disabledRules.filter((ruleId) => !validRules.has(ruleId));

  if (invalid.length > 0) {
    throw new Error(
      `disabledRules contains unknown rule ids: ${invalid.join(", ")}`,
    );
  }

  return disabledRules;
};

const parseList = (value: string | undefined): string[] =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const parseCliArgs = (argv: string[]) => {
  let target: string | undefined;
  let configPath: string | undefined;
  let output: OutputFormat | undefined;
  let failOn: FailOn | undefined;

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

const loadConfigFile = async (configPath: string): Promise<ConfigFile> => {
  const fileContents = await readFile(configPath, "utf8");
  const parsed = JSON.parse(fileContents) as ConfigFile;

  return parsed;
};

const configExists = async (configPath: string): Promise<boolean> => {
  try {
    await access(configPath);
    return true;
  } catch {
    return false;
  }
};

export const printHelp = (): void => {
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

export const loadAppConfig = async (argv: string[]): Promise<AppConfig> => {
  const cli = parseCliArgs(argv);
  const configPath = path.resolve(
    process.cwd(),
    cli.configPath ?? readEnv("config") ?? DEFAULT_CONFIG_PATH,
  );
  const hasConfig = await configExists(configPath);
  const fileConfig = hasConfig ? await loadConfigFile(configPath) : {};

  const merged: AppConfig = {
    target:
      cli.target ??
      readEnv("target") ??
      fileConfig.target ??
      DEFAULT_CONFIG.target,
    output:
      cli.output ??
      (readEnv("output") ? validateOutput(readEnv("output")) : undefined) ??
      (fileConfig.output ? validateOutput(fileConfig.output) : undefined) ??
      DEFAULT_CONFIG.output,
    failOn:
      cli.failOn ??
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
