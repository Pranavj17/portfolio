# pranav-j

> Pranav Jagadish's portfolio — in your terminal.

```
npx pranav-j
```

That's it. Zero install, just one command in any terminal with Node.js 14+.

## What you get

A focused, color-printed portfolio summary covering:

- **About** — what I build and where I focus
- **Experience** — Scripbox (Sep 2022–present), SAKHA Global (Jul 2019–Sep 2022)
- **Skills** — Elixir, MCP, distributed systems, Cloudflare Workers, the rest of the stack
- **Projects** — live MCP demo, `mcp-server-graylog` (Anthropic catalog), Memory MCP server, OpenClaw, and the SSRF guard module
- **Writing** — Medium @jpranav97
- **Contact** — site, GitHub, LinkedIn, Medium, email

## Flags

```
npx pranav-j               # full portfolio
npx pranav-j --resume      # experience + skills only
npx pranav-j --projects    # projects section only
npx pranav-j --contact     # contact info
npx pranav-j --no-color    # strip ANSI · pipe-safe
npx pranav-j --help        # usage
```

## Pipe-friendly

```bash
npx pranav-j --no-color > pranav.txt    # save to file
npx pranav-j | less -R                  # scroll with colors
npx pranav-j --resume | grep elixir     # filter
```

`NO_COLOR=1` (the universal convention) also disables colors. Non-TTY output auto-disables them too, so piping just works.

## Why a terminal portfolio?

Most portfolios are HTML — fine, but they don't survive a tab close. A terminal portfolio lives where engineers actually work, prints in two seconds, and turns "share Pranav's resume" into a single line: `npx pranav-j`. No download, no PDF, no signup.

The full interactive version (with a real Model Context Protocol demo, live shell, and a slash-command menu) lives at **[pranavjagadish.com](https://pranavjagadish.com)**.

## Honest scope

This CLI is a static print-and-exit. It does not phone home, save state, or do anything beyond writing styled text to stdout. The whole runtime is one file plus [picocolors](https://github.com/alexeyraspopov/picocolors) — a 3KB, zero-dependency colorizer.

## License

MIT — see [LICENSE](https://github.com/Pranavj17/portfolio/blob/main/LICENSE).
