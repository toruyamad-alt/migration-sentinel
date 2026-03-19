const buildFinding = (context, rule, line, detail) => ({
    filePath: context.filePath,
    line,
    severity: rule.severity,
    ruleId: rule.id,
    title: rule.title,
    detail,
});
const findLineNumbers = (lines, pattern) => {
    const results = [];
    lines.forEach((line, index) => {
        if (pattern.test(line)) {
            results.push(index + 1);
        }
    });
    return results;
};
export const rules = [
    {
        id: "destructive-drop",
        severity: "high",
        title: "Destructive drop detected",
        match: (context) => findLineNumbers(context.lines, /\bDROP\s+(TABLE|COLUMN|DATABASE|INDEX)\b/i).map((line) => buildFinding(context, rules[0], line, "Dropping tables, columns, or indexes can destroy production data or break rollbacks.")),
    },
    {
        id: "rename-operation",
        severity: "medium",
        title: "Rename operation detected",
        match: (context) => findLineNumbers(context.lines, /\b(RENAME\s+(COLUMN|TABLE)|rename_column|rename_table)\b/i).map((line) => buildFinding(context, rules[1], line, "Renames often break application code, analytics, and older deploys unless shipped carefully.")),
    },
    {
        id: "unsafe-not-null",
        severity: "high",
        title: "NOT NULL added without obvious backfill",
        match: (context) => {
            const matches = findLineNumbers(context.lines, /\b(SET\s+NOT\s+NULL|ADD\s+COLUMN\b.*\bNOT\s+NULL\b)\b/i);
            const hasBackfill = /\bUPDATE\b[\s\S]*\bSET\b/i.test(context.text);
            const hasDefault = /\bDEFAULT\b/i.test(context.text);
            if (hasBackfill || hasDefault) {
                return [];
            }
            return matches.map((line) => buildFinding(context, rules[2], line, "Adding NOT NULL without a backfill or default can fail on existing rows during deploy."));
        },
    },
    {
        id: "non-concurrent-index",
        severity: "medium",
        title: "Index creation may lock writes",
        match: (context) => findLineNumbers(context.lines, /\bCREATE\s+(UNIQUE\s+)?INDEX\b(?!.*CONCURRENTLY)/i).map((line) => buildFinding(context, rules[3], line, "Postgres index creation without CONCURRENTLY can lock large tables in production.")),
    },
    {
        id: "column-type-change",
        severity: "high",
        title: "Column type change detected",
        match: (context) => findLineNumbers(context.lines, /\bALTER\s+COLUMN\b.*\bTYPE\b|\bchange_column\b/i).map((line) => buildFinding(context, rules[4], line, "Column type changes can rewrite large tables and need explicit rollout planning.")),
    },
    {
        id: "data-delete",
        severity: "high",
        title: "Bulk delete statement detected",
        match: (context) => findLineNumbers(context.lines, /^\s*DELETE\s+FROM\b/i).map((line) => buildFinding(context, rules[5], line, "Deleting data inside a migration is hard to roll back and should be reviewed manually.")),
    },
];
export const supportedExtensions = new Set([
    ".sql",
    ".ts",
    ".js",
    ".rb",
    ".py",
]);
export const runRules = (context) => rules.flatMap((rule) => rule.match(context));
