export interface SessionMatch {
    sessionId: string;
    projectDir: string;
    date: string;
    snippets: string[];
    matchCount: number;
    resumeCommand: string;
}
export interface SearchOptions {
    maxResults?: number;
    daysBack?: number;
    projectFilter?: string;
}
/**
 * Search all Claude Code session transcripts for a query string.
 * Returns matching sessions with context snippets and resume commands.
 */
export declare function searchSessions(query: string, options?: SearchOptions): Promise<SessionMatch[]>;
/**
 * Get expanded context from a specific session around matching lines.
 */
export declare function getSessionContext(sessionId: string, query: string, contextLines?: number): Promise<string[]>;
/**
 * List recent sessions across all projects.
 */
export declare function listRecentSessions(count?: number, projectFilter?: string): Promise<{
    sessionId: string;
    projectDir: string;
    date: string;
    sizeKB: number;
}[]>;
//# sourceMappingURL=search.d.ts.map