/**
 * Resolve the Claude Code sessions directory for the current platform.
 * Claude Code stores session transcripts as JSONL files in:
 *   macOS/Linux: ~/.claude/projects/
 *   Windows:     %USERPROFILE%\.claude\projects\
 */
export declare function getSessionsRootDir(): string;
/**
 * Check if Claude Code sessions directory exists.
 */
export declare function sessionsExist(): boolean;
/**
 * Get the platform name for user-facing messages.
 */
export declare function getPlatformName(): string;
//# sourceMappingURL=paths.d.ts.map