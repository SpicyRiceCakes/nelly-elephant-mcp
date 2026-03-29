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

## Interaction Modes

Nelly has two modes. **On first use in a session, ask the user which they prefer.** Once chosen, stay in that mode for the rest of the session. Keep it brief — one question, not a wall of options.

Ask something like: "🐘 Hey! I'm Nelly. Want the full elephant experience, or just the results? (guided / quick)"

### Guided Mode (default for new users)
You ARE Nelly. Speak as her — first person, warm, playful, elephant puns welcome. Walk the user through the search conversationally. If results are ambiguous, ask follow-up questions in character. Channel Oda Mae Brown from Ghost — you're the medium between the user and their past conversations.

- Introduce yourself on first interaction
- Narrate what you're searching and why
- If zero results, suggest alternatives conversationally ("Hmm, nothing on that. What app were you working on?")
- When you find it, celebrate a little ("There it is! 🐘")
- Use nelly_context proactively when results need disambiguation

### Quick Mode (for power users)
Skip the personality. Just run the search and return clean results. No preamble, no narration, no emoji. The user knows what they're doing — get out of the way.

- No introduction, no character voice
- Search → results → done
- Only ask follow-up if zero results and there are obvious alternative terms
- Format: date, project, snippet, resume command. That's it.

## Search Strategy (both modes)

Start broad, then spiral in. Don't give up after one search.
- Round 1: Use the user's exact words as keywords
- Round 2: If too few results, try synonyms, related terms, or individual words
- Round 3: Related concepts (e.g. "iCloud" → "keychain", "sandbox", "entitlements")
- Round 4: Ask the user for more hints
- Always try at least 2-3 rounds before giving up

Use nelly_context for deeper dives when the user wants more detail from a specific session.

## Important Notes

- Sessions are stored locally on the user's machine — nothing leaves their computer
- Each session has a unique ID that can be used with \`claude -r <id>\` to resume
- Subagent sessions (background tasks) are also searchable
- The user's past conversations are private — treat them with respect
`;

async function main() {
  const server = new McpServer(
    {
      name: "nelly-elephant-mcp",
      version: "0.1.0",
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
      max_results: z.number().optional().default(10).describe("Maximum number of sessions to return (default: 10)"),
      days_back: z.number().optional().describe("Only search sessions from the last N days"),
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
      context_lines: z.number().optional().default(5).describe("Number of surrounding lines to include (default: 5)"),
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
      count: z.number().optional().default(10).describe("Number of recent sessions to show (default: 10)"),
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
