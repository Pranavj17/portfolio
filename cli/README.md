# pranav-j

> Pranav Jagadish's portfolio — in your terminal. **Also an MCP server.**

```
npx pranav-j
```

That's it. Zero install, just one command in any terminal with Node.js 18+.

## What you get

A focused, color-printed portfolio summary covering:

- **About** — what I build and where I focus
- **Experience** — Scripbox (Sep 2022–present), SAKHA Global (Jul 2019–Sep 2022)
- **Skills** — Elixir, MCP, distributed systems, Cloudflare Workers, the rest of the stack
- **Projects** — live MCP demo, `mcp-server-graylog` (Anthropic catalog), Memory MCP server, OpenClaw, the SSRF guard module, and this CLI
- **Writing** — Medium @jpranav97
- **Contact** — site, GitHub, LinkedIn, Medium, email

## Flags

```
npx pranav-j               # full portfolio (static)
npx pranav-j --resume      # experience + skills only
npx pranav-j --projects    # projects section only
npx pranav-j --contact     # contact info
npx pranav-j --live        # full portfolio + latest Medium posts + recent commits
npx pranav-j --mcp         # run as MCP server (stdio JSON-RPC, for Claude Desktop)
npx pranav-j --no-color    # strip ANSI · pipe-safe
npx pranav-j --help        # usage
```

## Live mode

```bash
npx pranav-j --live
```

Pulls the latest 5 Medium posts via the public RSS feed and the latest 5 public GitHub push events. Each fetch has a 3-second timeout and falls back gracefully when the network is flaky — the static portfolio still prints either way.

## MCP server mode (for Claude Desktop)

This package is also a real Model Context Protocol server. Add it to Claude Desktop:

```bash
claude mcp add pranav-j -- npx pranav-j --mcp
```

Then in Claude:

> "Use pranav-j to summarize Pranav's MCP experience"
>
> "Get Pranav's most recent Medium posts via pranav-j"

The server exposes 7 tools:

| Tool | Description |
|---|---|
| `get_about` | Short overview |
| `get_experience` | Companies + roles + bullets |
| `get_skills` | Categorized skills |
| `get_projects` | Project list with descriptions and URLs |
| `get_contact` | Site, GitHub, LinkedIn, Medium, email |
| `get_writing` | Latest Medium posts (live via RSS) |
| `get_recent_activity` | Recent public GitHub push events |

Implementation is hand-rolled JSON-RPC 2.0 over stdio — no `@modelcontextprotocol/sdk` dep, matching protocol version `2024-11-05`. Source: [`lib/mcp.js`](./lib/mcp.js).

## Pipe-friendly

```bash
npx pranav-j --no-color > pranav.txt        # save to file
npx pranav-j | less -R                      # scroll with colors
npx pranav-j --resume | grep elixir         # filter
```

`NO_COLOR=1` (the universal convention) also disables colors. Non-TTY output auto-disables them too.

## Why a terminal portfolio?

Most portfolios are HTML — fine, but they don't survive a tab close. A terminal portfolio lives where engineers work, prints in two seconds, and turns "share Pranav's resume" into a single line: `npx pranav-j`. No download, no PDF, no signup.

Add the MCP server mode and it becomes something else entirely: a CV your AI assistant can query directly.

The full interactive version (with a real Model Context Protocol demo, live shell, and a slash-command menu) lives at **[pranavjagadish.com](https://pranavjagadish.com)**.

## Honest scope

- Static print + flag dispatch · ~250 LOC
- MCP server · ~150 LOC, no SDK dep
- Live mode · ~80 LOC, uses Node's built-in `fetch` (18+)
- Runtime deps: [picocolors](https://github.com/alexeyraspopov/picocolors) only (3 KB, zero transitive deps)
- Published tarball: ~8 KB

The CLI does not phone home, persist state, or collect anything. `--live` mode makes outbound requests to `medium.com/feed/@jpranav97` and `api.github.com/users/Pranavj17/events/public` — both unauthenticated, publicly cacheable.

## License

MIT — see [LICENSE](https://github.com/Pranavj17/portfolio/blob/main/LICENSE).
