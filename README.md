# nelly-elephant-mcp

> An elephant never forgets — and neither should your AI.

Search and resume past Claude Code conversations via the [Model Context Protocol](https://modelcontextprotocol.io) (MCP).

**[Read the full story →](https://spicyricecakes.github.io/nelly-elephant-mcp/)**

## Install

```bash
npm install -g nelly-elephant-mcp
```

Or install from source:

```bash
git clone https://github.com/SpicyRiceCakes/nelly-elephant-mcp.git
cd nelly-elephant-mcp
npm install && npm run build
npm install -g .
```

## Configure

### Where Nelly looks

Claude Code stores **all** session transcripts — from every project — in one place:

```
~/.claude/projects/
  ├── -Users-you-project-alpha/     ← sessions from project alpha
  │   ├── abc123.jsonl
  │   └── def456.jsonl
  ├── -Users-you-project-beta/      ← sessions from project beta
  │   └── ghi789.jsonl
  └── ...                           ← every project you've ever opened
```

Nelly searches **all of them at once**. It doesn't matter which project you're in when you ask — she searches everything.

### Recommended: Global (available in every project)

```bash
claude mcp add -s user nelly -- nelly-elephant-mcp
```

Restart Claude Code. Nelly is ready.

### Alternative: Current project only

```bash
claude mcp add nelly -- nelly-elephant-mcp
```

> Even in per-project mode, Nelly still searches all sessions. The only difference is whether she's available to call.

## Trunk Modes

Nelly has two modes — just say which one you want:

- **🐘 Long Trunk** — the full Nelly experience. She'll talk you through the search, ask follow-up questions, and celebrate when she finds it. An elephant never forgets.
- **🐘 Short Trunk** — just the results. No personality, no narration. Date, project, snippet, resume command. Done.

Say "Nelly long trunk" or "Nelly short trunk" to switch anytime.

## Tools

| Tool | What it does |
|------|-------------|
| `nelly_instructions` | Returns usage guide and system status. |
| `nelly_search` | Search past sessions by keyword. Supports date range and project filters. |
| `nelly_context` | Get expanded context from a specific session. |
| `nelly_recent` | List most recent sessions. |

## How it works

Claude Code stores session transcripts as JSONL files in `~/.claude/projects/`. Nelly searches these files, extracts human-readable text, and returns matching sessions with `claude --resume` commands.

You can filter by project name or date range if you want to narrow the search. But by default, Nelly searches everything — that's the point.

The AI uses a "spiral search" pattern — starting broad, trying variations, and asking for hints rather than giving up after one attempt.

## Privacy

Elephants have trunks, not phones.

**What Nelly does:** Reads local files on your machine. Zero network calls. Zero telemetry. Zero data collection. Nelly doesn't send data anywhere. Read the source — it's four files.

**What you should know:** Nelly runs inside Claude Code. When she finds a matching session, the snippets and project names she returns become part of your current conversation for Claude to process — the same way anything you discuss in a Claude session does. Nelly isn't sending data anywhere extra — it's just that whatever she finds becomes part of the chat, like reading a file or pasting text.

In plain English: Nelly searches locally, but the results become part of your conversation. For sensitive searches, use `grep` directly in your terminal instead — that stays fully on your machine.

**Use Nelly for moments of need, not as a browsing tool.** Every search puts past session content into your current conversation. Search when you need to find something specific, not to casually explore your history.

**Never use Nelly to search for passwords, API keys, or secrets.** If a past session contains a leaked credential, searching for it with Nelly copies it into a second session — doubling the exposure. Use `grep` directly in your terminal instead:

```bash
grep -r "your-search-term" ~/.claude/projects/
```

That stays fully local. No API, no cloud, no second copy.

## Compatibility

| Version | Platform | Status |
|---------|----------|--------|
| v1.0 | Claude Code (macOS, Windows, Linux) | Live |
| v1.a | Codex CLI | PRs welcome |
| v1.b | Gemini CLI | PRs welcome |
| v1.c | Cursor | Research needed |
| v1.d | Windsurf | Research needed |
| v1.e | Cline | Research needed |

## Contributing

We built the Claude Code adapter. Want to make one for your tool?

- Fork the repo and look at `src/search.ts` — that's the pattern
- Adapters need to find session files and parse them for your tool's format
- PRs welcome

## Origin

Born from a real need — couldn't find a fix from a previous session. Knew it was somewhere in the conversation history but couldn't remember which one. Searched with grep, found it, realized this should be a tool. Built it that night.

**[Read the full story →](https://spicyricecakes.github.io/nelly-elephant-mcp/)**

## License

MIT

---

Built by [SpicyRiceCakes](https://github.com/SpicyRiceCakes) x Claude
