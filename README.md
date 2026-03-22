# opencode-memos

OpenCode plugin that gives coding agents persistent memory using [MemOS](https://memos.openmem.net).

Your agent will remember everything you tell it — across sessions, across projects.

## Installation

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/cmore-air/opencode-memos/main/install.sh | bash
```

### Windows

```batch
irm https://raw.githubusercontent.com/cmore-air/opencode-memos/main/install.bat | iex
```

Or download and run `install.bat` manually.

Both scripts will:
1. Download and install the plugin to `~/.config/opencode/plugins/opencode-memos`
2. Register the plugin in OpenCode config
3. Create the `/mem-os-init` and `/mem-os-help` commands

### Configure environment variables

Get your API key from [MemOS Dashboard](https://memos-dashboard.openmem.net/apikeys/), then set:

```bash
export MEMOS_API_KEY="your_api_key"
export MEMOS_USER_ID="your_user_id"
export MEMOS_CHANNEL="your_channel"
```

> **Tip**: Add these to your shell config (e.g., `~/.bashrc` or `~/.zshrc`) for persistence.

## Features

### Context Injection

On the first message, the agent automatically receives (invisible to user):

- Factual memories (project knowledge)
- Preference memories (user preferences)
- Tool memories (usage experience)

### Keyword Detection

When you say "remember", "save this", "don't forget", etc., the agent automatically saves to memory.

### Tool Usage

The `mem-os` tool is available for the agent:

| Mode | Args | Description |
|------|------|-------------|
| `add` | `content` | Add a memory |
| `search` | `query` | Search memories |
| `get` | `memoryId` | Get a single memory |
| `delete` | `memoryIds` | Delete memories |
| `feedback` | `content` | Add feedback |

## Initialize Codebase

After installation, you can run the init command to let the agent explore and memorize the codebase:

```
/mem-os-init
```

## Configuration

All configuration via environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `MEMOS_API_KEY` | Yes | MemOS API key |
| `MEMOS_USER_ID` | Yes | User ID |
| `MEMOS_CHANNEL` | Yes | Channel identifier |

Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMOS_BASE_URL` | MemOS default | API URL |

## Development

```bash
git clone https://github.com/cmore-air/opencode-memos
cd opencode-memos
bun install
bun run build
```

To test your local changes, update the plugin path in `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugin": ["file:///path/to/opencode-memos"]
}
```

## Logs

```bash
tail -f ~/.opencode-memos.log
```

## License

MIT
