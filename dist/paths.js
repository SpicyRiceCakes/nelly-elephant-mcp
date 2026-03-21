import { homedir, platform } from "os";
import { join } from "path";
import { existsSync } from "fs";
/**
 * Resolve the Claude Code sessions directory for the current platform.
 * Claude Code stores session transcripts as JSONL files in:
 *   macOS/Linux: ~/.claude/projects/
 *   Windows:     %USERPROFILE%\.claude\projects\
 */
export function getSessionsRootDir() {
    return join(homedir(), ".claude", "projects");
}
/**
 * Check if Claude Code sessions directory exists.
 */
export function sessionsExist() {
    return existsSync(getSessionsRootDir());
}
/**
 * Get the platform name for user-facing messages.
 */
export function getPlatformName() {
    switch (platform()) {
        case "darwin":
            return "macOS";
        case "win32":
            return "Windows";
        case "linux":
            return "Linux";
        default:
            return platform();
    }
}
//# sourceMappingURL=paths.js.map