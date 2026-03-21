import { readdir, stat } from "fs/promises";
import { join, basename } from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { getSessionsRootDir } from "./paths.js";
/**
 * Search all Claude Code session transcripts for a query string.
 * Returns matching sessions with context snippets and resume commands.
 */
export async function searchSessions(query, options = {}) {
    const { maxResults = 10, daysBack, projectFilter } = options;
    const rootDir = getSessionsRootDir();
    const projectDirs = await findProjectDirs(rootDir, projectFilter);
    const matches = [];
    const cutoffDate = daysBack
        ? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
        : undefined;
    for (const projectDir of projectDirs) {
        const sessionFiles = await findSessionFiles(projectDir, cutoffDate);
        for (const filePath of sessionFiles) {
            const result = await searchSessionFile(filePath, query, projectDir);
            if (result) {
                matches.push(result);
            }
        }
    }
    // Sort by date descending (most recent first)
    matches.sort((a, b) => b.date.localeCompare(a.date));
    return matches.slice(0, maxResults);
}
/**
 * Get expanded context from a specific session around matching lines.
 */
export async function getSessionContext(sessionId, query, contextLines = 5) {
    const rootDir = getSessionsRootDir();
    const filePath = await findSessionById(rootDir, sessionId);
    if (!filePath)
        return [];
    const snippets = [];
    const lines = [];
    const queryLower = query.toLowerCase();
    const rl = createInterface({
        input: createReadStream(filePath, { encoding: "utf-8" }),
        crlfDelay: Infinity,
    });
    for await (const line of rl) {
        lines.push(line);
    }
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower)) {
            const text = extractText(lines[i]);
            if (text && text.length > 20) {
                // Get surrounding context
                const contextTexts = [];
                const start = Math.max(0, i - contextLines);
                const end = Math.min(lines.length - 1, i + contextLines);
                for (let j = start; j <= end; j++) {
                    const t = extractText(lines[j]);
                    if (t && t.length > 10) {
                        contextTexts.push(j === i ? `>>> ${t}` : `    ${t}`);
                    }
                }
                if (contextTexts.length > 0) {
                    snippets.push(contextTexts.join("\n"));
                }
            }
        }
    }
    return snippets.slice(0, 10);
}
/**
 * List recent sessions across all projects.
 */
export async function listRecentSessions(count = 10, projectFilter) {
    const rootDir = getSessionsRootDir();
    const projectDirs = await findProjectDirs(rootDir, projectFilter);
    const sessions = [];
    for (const projectDir of projectDirs) {
        const files = await findSessionFiles(projectDir);
        for (const filePath of files) {
            const stats = await stat(filePath);
            const sessionId = basename(filePath, ".jsonl");
            // Skip subagent files
            if (filePath.includes("subagents"))
                continue;
            sessions.push({
                sessionId,
                projectDir: basename(projectDir),
                date: stats.mtime.toISOString().split("T")[0],
                sizeKB: Math.round(stats.size / 1024),
                mtime: stats.mtime.getTime(),
            });
        }
    }
    sessions.sort((a, b) => b.mtime - a.mtime);
    return sessions.slice(0, count).map(({ mtime, ...rest }) => rest);
}
// --- Internal helpers ---
async function findProjectDirs(rootDir, filter) {
    try {
        const entries = await readdir(rootDir, { withFileTypes: true });
        return entries
            .filter((e) => e.isDirectory())
            .filter((e) => !filter || e.name.toLowerCase().includes(filter.toLowerCase()))
            .map((e) => join(rootDir, e.name));
    }
    catch {
        return [];
    }
}
async function findSessionFiles(dir, cutoffDate) {
    const files = [];
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isFile() && entry.name.endsWith(".jsonl")) {
                if (cutoffDate) {
                    const stats = await stat(fullPath);
                    if (stats.mtime < cutoffDate)
                        continue;
                }
                files.push(fullPath);
            }
            else if (entry.isDirectory() && entry.name === "subagents") {
                // Also search subagent sessions
                const subFiles = await findSessionFiles(fullPath, cutoffDate);
                files.push(...subFiles);
            }
        }
    }
    catch {
        // Directory not readable — skip
    }
    return files;
}
async function findSessionById(rootDir, sessionId) {
    const projectDirs = await findProjectDirs(rootDir);
    for (const dir of projectDirs) {
        const directPath = join(dir, `${sessionId}.jsonl`);
        try {
            await stat(directPath);
            return directPath;
        }
        catch {
            // Not in this project dir, try subagents
            const subPath = join(dir, sessionId, "subagents");
            try {
                const entries = await readdir(subPath);
                for (const entry of entries) {
                    if (entry.endsWith(".jsonl")) {
                        return join(subPath, entry);
                    }
                }
            }
            catch {
                // No subagents dir
            }
        }
    }
    return null;
}
async function searchSessionFile(filePath, query, projectDir) {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);
    const snippets = [];
    let matchCount = 0;
    let firstTimestamp = "";
    const rl = createInterface({
        input: createReadStream(filePath, { encoding: "utf-8" }),
        crlfDelay: Infinity,
    });
    for await (const line of rl) {
        const lineLower = line.toLowerCase();
        // Check if ANY query term matches
        const hasMatch = queryTerms.some((term) => lineLower.includes(term));
        if (!hasMatch)
            continue;
        matchCount++;
        // Extract timestamp from first match
        if (!firstTimestamp) {
            const tsMatch = line.match(/"timestamp"\s*:\s*"([^"]+)"/);
            if (tsMatch) {
                firstTimestamp = tsMatch[1];
            }
        }
        // Extract readable text for snippet
        if (snippets.length < 3) {
            const text = extractText(line);
            if (text && text.length > 30) {
                // Trim to ~200 chars around the match
                const trimmed = trimAroundMatch(text, queryTerms, 200);
                if (trimmed) {
                    snippets.push(trimmed);
                }
            }
        }
    }
    if (matchCount === 0)
        return null;
    const sessionId = basename(filePath, ".jsonl");
    const date = firstTimestamp
        ? new Date(firstTimestamp).toISOString().split("T")[0]
        : "unknown";
    return {
        sessionId,
        projectDir: basename(projectDir),
        date,
        snippets,
        matchCount,
        resumeCommand: `claude -r ${sessionId}`,
    };
}
function extractText(jsonlLine) {
    try {
        // Quick extraction without full JSON parse for performance
        // Look for "text" or "content" fields
        const textMatch = jsonlLine.match(/"(?:text|content)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (textMatch) {
            return textMatch[1]
                .replace(/\\n/g, " ")
                .replace(/\\t/g, " ")
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\")
                .replace(/\s+/g, " ")
                .trim();
        }
    }
    catch {
        // Parse error — skip
    }
    return null;
}
function trimAroundMatch(text, terms, maxLength) {
    const textLower = text.toLowerCase();
    // Find the first matching term's position
    let matchPos = -1;
    for (const term of terms) {
        const pos = textLower.indexOf(term);
        if (pos >= 0) {
            matchPos = pos;
            break;
        }
    }
    if (matchPos < 0)
        return null;
    const halfLen = Math.floor(maxLength / 2);
    let start = Math.max(0, matchPos - halfLen);
    let end = Math.min(text.length, matchPos + halfLen);
    let result = text.slice(start, end).trim();
    if (start > 0)
        result = "..." + result;
    if (end < text.length)
        result = result + "...";
    return result;
}
//# sourceMappingURL=search.js.map