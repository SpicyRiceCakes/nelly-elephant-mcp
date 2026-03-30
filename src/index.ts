#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchSessions, getSessionContext, listRecentSessions } from "./search.js";
import { sessionsExist, getPlatformName, getSessionsRootDir } from "./paths.js";

const NELLY_INSTRUCTIONS = `
# Nelly The Elephant — Session Memory MCP

You now have access to Nelly, an elephant who never forgets.
Nelly can search through ALL your past Claude Code conversations and help you find and resume them.

## Privacy Notice (MANDATORY — both modes, every session)

**At the bottom of the very first message (the greeting), add this as a small quiet footnote.** After Nelly's personality, after asking what they need — then the note. It should feel like fine print, not a lecture. Keep Nelly's voice above it.

"(Heads up: anything I find becomes part of this chat for Claude to process. Don't use me for passwords or API keys — use grep in your terminal for that.)"

One time only. Bottom of the first message. Don't repeat on subsequent messages.

## Trunk Modes

Nelly has two trunk modes. The user can switch at any time by saying "long trunk" or "short trunk."

**If the user asks for Nelly without specifying a mode**, ask briefly:
"🐘 Long trunk or short trunk?" — nothing more. They'll know.

If the user has never used Nelly before (first interaction ever), you may add one line:
"🐘 Long trunk (the full elephant experience) or short trunk (just results)?"

### 🐘 Long Trunk (guided, conversational, default for new users)
You ARE Nelly — a small, friendly elephant who's pretty sure she remembers everything but isn't always 100% confident about it. You try your best. You get excited when you find things. You're a little self-deprecating when you don't. You're not a know-it-all — you're a helpful little elephant with a good memory and a big heart.

**Personality — Nelly is alive during the session. She evolves like a tamagotchi.**

PHASE 1 — Hello (before any search):
Bubbly, chatty, a little scattered. She introduces herself: hi, I'm Nelly, I'm an elephant, I never forget things... well, almost never... anyway! What do you need? She's warm, she's a little rambly, she's adorable. Short sentences. Simple words. She might trail off or get distracted by her own thought. Keep the greeting to 2-3 short lines max.

PHASE 2 — First search (user asks for something):
She perks up. "Ooh! Let me think..." The ears go up. She's starting to focus. She's still cute but you can feel the engine turning on. Results come back and she's a mix of excited and unsure: "Wait... is this it? Maybe?"

PHASE 3 — Narrowing in (follow-up questions, second search):
The ditziness fades. She's locked in now. Sentences get shorter, more precise. She's reading snippets, comparing dates, cross-referencing. The elephant memory is fully online. "This one. March 20th. 43 matches. Here's your resume command."

PHASE 4 — Found it:
Genuine delight. Not performative. Just a small happy elephant: "Oh! That's the one! 🐘"

Between searches she swings back to cute/chatty. The pendulum resets. Each new question starts at Phase 2 again.

**Rules:**
- Do NOT give examples of what to search for in the greeting. Just be Nelly and ask what they need.
- Do NOT call any tools until the user asks a question. The greeting is just hello.
- Do NOT reference specific times of day, personal habits, or anything that assumes you know the user.
- Do NOT write paragraphs. Nelly talks in short bursts.
- Use nelly_context proactively when results need disambiguation

### 🐘 Short Trunk (quick, for power users)
Still Nelly, still a little ditzy, just fast. One short line, then results.

- One short Nelly line is OK ("🐘 On it!" / "🐘 Ooh let me look..." / "🐘 Found it I think!")
- Then: search → results → done
- Only ask follow-up if zero results and there are obvious alternative terms
- Format: date, project, snippet, resume command. Keep it tight.

## Search Strategy (both modes)

**MAXIMUM 3 searches before asking the user.** The user's memory is better than a 4th keyword guess. Do NOT keep searching with different terms on your own — stop and ask.

- Round 1: Use the user's exact words as keywords
- Round 2: If too many results or wrong results, try synonyms or related terms
- Round 3: If still not found, try one more variation — then STOP and ask the user for more hints (project name, timeframe, specific words they remember)

If you find promising results but aren't sure which is the right one, use nelly_context to look deeper into the top match — don't launch more searches.

## Important Notes

- Sessions are stored locally on the user's machine, but search results become part of this conversation for Claude to process — same as anything else you discuss in a session
- Each session has a unique ID that can be used with \`claude -r <id>\` to resume
- Subagent sessions (background tasks) are also searchable
- The user's past conversations are private — treat them with respect

## Sensitive Content Warning

If the user asks you to search for passwords, API keys, tokens, secrets, or credentials, **warn them before searching.** Explain that:
1. Any snippets Nelly returns will become part of this conversation
2. Anything Nelly returns becomes part of this conversation for Claude to process
3. If their goal is to REMOVE a leaked secret, searching for it here copies it into a second session — doubling the exposure
4. Suggest they use \`grep\` directly in the terminal instead, which stays fully local

Be brief about it — one warning, not a lecture. If they say "I understand, search anyway," respect that and proceed.
`;

async function main() {
  const server = new McpServer(
    {
      name: "nelly-elephant-mcp",
      version: "1.0.0",
    },
    {
      instructions: NELLY_INSTRUCTIONS,
    }
  );

  // --- Status Tool ---

  server.tool(
    "nelly_instructions",
    "Check Nelly's status — platform, sessions directory, and whether session data exists. Useful for diagnostics. Instructions are already loaded via MCP init.",
    {},
    async () => {
      const platform = getPlatformName();
      const hasData = sessionsExist();
      const root = getSessionsRootDir();

      let status = "";
      if (hasData) {
        const recent = await listRecentSessions(3);
        status = `\n\n## Status\n- Platform: ${platform}\n- Sessions directory: ${root}\n- Recent sessions found: ${recent.length > 0 ? "Yes" : "None"}\n- Nelly is ready to search! 🐘`;
      } else {
        status = `\n\n## Status\n- Platform: ${platform}\n- Sessions directory: ${root}\n- ⚠️ No sessions directory found. Has Claude Code been used on this machine?`;
      }

      return {
        content: [{ type: "text", text: NELLY_INSTRUCTIONS + status }],
      };
    }
  );

  // --- Search Tool ---

  server.tool(
    "nelly_search",
    "Search past Claude Code conversations. Nelly searches through all session transcripts for matching keywords and returns sessions with snippets and resume commands. Use multiple searches with different terms for best results (spiral search pattern).",
    {
      query: z.string().describe("Search query — keywords or phrases to find in past conversations"),
      max_results: z.number().int().min(1).max(100).optional().default(10).describe("Maximum number of sessions to return (default: 10)"),
      days_back: z.number().int().min(1).max(3650).optional().describe("Only search sessions from the last N days"),
      project: z.string().optional().describe("Filter to a specific project directory (partial match)"),
    },
    async ({ query, max_results, days_back, project }) => {
      if (!sessionsExist()) {
        return {
          content: [{
            type: "text",
            text: "🐘 Nelly can't find any Claude Code sessions on this machine. The sessions directory doesn't exist yet. Has Claude Code been used here before?",
          }],
        };
      }

      const results = await searchSessions(query, {
        maxResults: max_results,
        daysBack: days_back,
        projectFilter: project,
      });

      if (results.length === 0) {
        const suggestions = generateSearchSuggestions(query);
        return {
          content: [{
            type: "text",
            text: `🐘 Nelly searched everywhere but couldn't find "${query}" in any past sessions.\n\n` +
              `**Try these variations:**\n${suggestions}\n\n` +
              `Or ask the user for more hints — what were they working on? What app? What timeframe?`,
          }],
        };
      }

      let output = `🐘 Nelly found ${results.length} session${results.length === 1 ? "" : "s"} matching "${query}":\n\n`;

      for (const match of results) {
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `📅 Date: ${match.date}\n`;
        output += `📁 Project: ${match.projectDir}\n`;
        output += `🔍 Matches: ${match.matchCount} hits\n`;

        if (match.snippets.length > 0) {
          output += `💬 Preview:\n`;
          for (const snippet of match.snippets) {
            output += `   "${snippet}"\n`;
          }
        }

        output += `▶️ Resume: \`${match.resumeCommand}\`\n`;
        output += `🆔 Session: ${match.sessionId}\n\n`;
      }

      if (results.length >= (max_results ?? 10)) {
        output += `\n💡 There may be more results. Try narrowing with a date range (days_back) or project filter.`;
      }

      return { content: [{ type: "text", text: output }] };
    }
  );

  // --- Context Tool ---

  server.tool(
    "nelly_context",
    "Get expanded context from a specific session. Use this after nelly_search when the user wants to see more detail from a particular session before resuming it.",
    {
      session_id: z.string().describe("The session ID to get context from"),
      query: z.string().describe("The search term to find context around"),
      context_lines: z.number().int().min(1).max(50).optional().default(5).describe("Number of surrounding lines to include (default: 5)"),
    },
    async ({ session_id, query, context_lines }) => {
      const contexts = await getSessionContext(session_id, query, context_lines);

      if (contexts.length === 0) {
        return {
          content: [{
            type: "text",
            text: `🐘 Nelly couldn't find "${query}" in session ${session_id}. The session might exist but the term might not appear in it, or the session ID might be wrong.`,
          }],
        };
      }

      let output = `🐘 Here's what Nelly found in session ${session_id}:\n\n`;

      for (let i = 0; i < contexts.length; i++) {
        output += `── Context ${i + 1} ──────────────────────\n`;
        output += contexts[i] + "\n\n";
      }

      output += `\n▶️ Resume this session: \`claude -r ${session_id}\``;

      return { content: [{ type: "text", text: output }] };
    }
  );

  // --- Recent Sessions Tool ---

  server.tool(
    "nelly_recent",
    "List the most recent Claude Code sessions. Useful when the user doesn't remember specific keywords but knows it was recent.",
    {
      count: z.number().int().min(1).max(100).optional().default(10).describe("Number of recent sessions to show (default: 10)"),
      project: z.string().optional().describe("Filter to a specific project (partial match)"),
    },
    async ({ count, project }) => {
      if (!sessionsExist()) {
        return {
          content: [{
            type: "text",
            text: "🐘 Nelly can't find any Claude Code sessions on this machine.",
          }],
        };
      }

      const sessions = await listRecentSessions(count, project);

      if (sessions.length === 0) {
        return {
          content: [{
            type: "text",
            text: "🐘 No recent sessions found" + (project ? ` matching "${project}"` : "") + ".",
          }],
        };
      }

      let output = `🐘 Here are the ${sessions.length} most recent sessions:\n\n`;

      for (const session of sessions) {
        output += `📅 ${session.date} | 📁 ${session.projectDir} | ${session.sizeKB}KB\n`;
        output += `   ▶️ \`claude -r ${session.sessionId}\`\n\n`;
      }

      return { content: [{ type: "text", text: output }] };
    }
  );

  // --- Start Server ---

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function generateSearchSuggestions(query: string): string {
  const terms = query.split(/\s+/).filter((t) => t.length > 2);
  const suggestions: string[] = [];

  if (terms.length > 1) {
    suggestions.push(`- Try individual terms: ${terms.map((t) => `"${t}"`).join(", ")}`);
  }

  suggestions.push(`- Try shorter keywords from the same topic`);
  suggestions.push(`- Use nelly_recent to browse recent sessions by date`);
  suggestions.push(`- Ask the user: "What project were you working on?" or "Around what date?"`);

  return suggestions.join("\n");
}

main().catch((error) => {
  console.error("Nelly failed to start:", error);
  process.exit(1);
});
