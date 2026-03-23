import { execFile } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

const CHAT_DB_PATH = join(homedir(), "Library", "Messages", "chat.db");

// ── Send ──────────────────────────────────────

export async function sendIMessage(
  text: string,
  handle: string
): Promise<string> {
  const escapedText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const escapedHandle = handle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
    tell application "Messages"
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant "${escapedHandle}" of targetService
      send "${escapedText}" to targetBuddy
    end tell
  `;

  try {
    await execFileAsync("osascript", ["-e", script]);
    return `Message sent to ${handle}`;
  } catch (error: any) {
    if (
      error.message?.includes("assistive") ||
      error.message?.includes("automation")
    ) {
      throw new Error(
        "Automation permission denied. Grant Terminal/Claude access in System Preferences > Privacy & Security > Automation."
      );
    }
    throw new Error(`Failed to send: ${error.message}`);
  }
}

// ── Search ────────────────────────────────────

export async function searchIMessages(options: {
  query?: string;
  handle?: string;
  limit?: number;
  daysBack?: number;
}): Promise<IMessageResult[]> {
  const { query, handle, limit = 20, daysBack } = options;

  const conditions: string[] = ["m.text IS NOT NULL", "length(m.text) > 0"];

  if (query) {
    const escapedQuery = query.replace(/'/g, "''");
    conditions.push(`m.text LIKE '%${escapedQuery}%'`);
  }

  if (handle) {
    const escapedHandle = handle.replace(/'/g, "''");
    conditions.push(`h.id = '${escapedHandle}'`);
  }

  if (daysBack) {
    // macOS absolute time: nanoseconds since 2001-01-01
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const macAbsTime = (cutoffDate.getTime() / 1000 - 978307200) * 1000000000;
    conditions.push(`m.date > ${macAbsTime}`);
  }

  const sql = `
    SELECT
      m.ROWID,
      COALESCE(m.text, '') as text,
      m.is_from_me,
      datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as date,
      COALESCE(h.id, '') as handle
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    WHERE ${conditions.join(" AND ")}
    ORDER BY m.date DESC
    LIMIT ${limit};
  `;

  try {
    const { stdout } = await execFileAsync("sqlite3", [
      "-separator",
      "|||",
      CHAT_DB_PATH,
      sql,
    ]);

    if (!stdout.trim()) return [];

    return stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [rowId, text, isFromMe, date, handleId] = line.split("|||");
        return {
          rowId: parseInt(rowId),
          text,
          isFromMe: isFromMe === "1",
          date,
          handle: handleId,
        };
      });
  } catch (error: any) {
    if (error.message?.includes("unable to open")) {
      throw new Error(
        "Cannot access Messages database. Grant Full Disk Access to Terminal in System Preferences > Privacy & Security."
      );
    }
    throw new Error(`Database query failed: ${error.message}`);
  }
}

// ── Conversations ─────────────────────────────

export async function listIMessageConversations(
  limit: number = 20
): Promise<IMessageConversation[]> {
  const sql = `
    SELECT
      h.id as handle,
      MAX(datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime')) as last_date,
      COUNT(*) as message_count
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    WHERE m.text IS NOT NULL
    GROUP BY h.id
    ORDER BY MAX(m.date) DESC
    LIMIT ${limit};
  `;

  try {
    const { stdout } = await execFileAsync("sqlite3", [
      "-separator",
      "|||",
      CHAT_DB_PATH,
      sql,
    ]);

    if (!stdout.trim()) return [];

    return stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [handle, lastDate, count] = line.split("|||");
        return { handle, lastDate, messageCount: parseInt(count) };
      });
  } catch (error: any) {
    throw new Error(`Database query failed: ${error.message}`);
  }
}

// ── Types ─────────────────────────────────────

export interface IMessageResult {
  rowId: number;
  text: string;
  isFromMe: boolean;
  date: string;
  handle: string;
}

export interface IMessageConversation {
  handle: string;
  lastDate: string;
  messageCount: number;
}
