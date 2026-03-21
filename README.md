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

### Recommended: Global config

Because Nelly searches across all projects, install her **globally** so she's available in every session. Add to `~/.claude/mcp_settings.json`:

```json
{
  "mcpServers": {
    "nelly": {
      "command": "nelly-elephant-mcp",
      "args": []
    }
  }
}
```

### Alternative: Per-project config

If you only want Nelly in specific projects, add to your project's `.mcp.json` instead:

```json
{
  "mcpServers": {
    "nelly": {
      "command": "nelly-elephant-mcp",
      "args": []
    }
  }
}
```

> Even in per-project mode, Nelly still searches all sessions. The only difference is whether she's available to call.

Restart Claude Code after configuring. Nelly is ready.

## Tools

| Tool | What it does |
|------|-------------|
| `nelly_instructions` | Call first. Returns usage guide and system status. |
| `nelly_search` | Search past sessions by keyword. Supports date range and project filters. |
| `nelly_context` | Get expanded context from a specific session. |
| `nelly_recent` | List most recent sessions. |

## How it works

Claude Code stores session transcripts as JSONL files in `~/.claude/projects/`. Nelly searches these files, extracts human-readable text, and returns matching sessions with `claude --resume` commands.

You can filter by project name (`projectFilter`) or date range (`daysBack`) if you want to narrow the search. But by default, Nelly searches everything — that's the point.

The AI is instructed to use a "spiral search" pattern — starting broad, trying variations, and asking for hints rather than giving up after one attempt.

## Privacy

Elephants have trunks, not phones.

Nelly reads **local files on your machine**. Zero network calls. Zero telemetry. Zero data collection. Read the source — it's four files.

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

We built the Claude adapter. Build yours:

- Each tool gets an adapter in `src/adapters/`
- Adapters implement session file discovery and parsing for their tool
- PRs welcome — People x Their AI, building together

## Origin

Born from a real need — couldn't find a past conversation about an iCloud password fix. Searched with grep, found it, realized this should be a tool. Built it that night.

[Read the AI's journal entry about building this.](https://spicyricecakes.github.io/nelly-elephant-mcp/)

## License

MIT

---

Built by [SpicyRiceCakes](https://github.com/SpicyRiceCakes) x Claude
