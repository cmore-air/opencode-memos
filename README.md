# opencode-memos

OpenCode plugin that gives coding agents persistent memory using [MemOS](https://memos.openmem.net).

Your agent will remember everything you tell it — across sessions, across projects.

## Installation

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/cmore-air/opencode-memos/main/install.sh | bash
```

### Windows

**PowerShell** (recommended):
```powershell
irm https://raw.githubusercontent.com/cmore-air/opencode-memos/main/install.ps1 | iex
```

**CMD** (alternative):
```batch
irm https://raw.githubusercontent.com/cmore-air/opencode-memos/main/install.bat | cmd
```

Or download and run the script manually.

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

### Memory Triggers

**When does the agent search for memories?**
- On **every user message** — the agent searches for relevant memories before responding

**When does the agent save memories?**
- **Automatically after every response** — the agent proactively saves a structured summary of the conversation
- When you use keywords like "remember", "save this", "don't forget"

### Memory Format

Saved memories include:
- User preferences
- Technical decisions
- Project facts
- Work patterns

### Context Injection

Before responding, the agent receives (invisible to you):

- Factual memories (project knowledge)
- Preference memories (user preferences)
- Tool memories (usage experience)

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

### Project-level config (recommended)

Create `mem-os.jsonc`, `mem-os.json`, `.mem-os.jsonc`, or `.mem-os.json` in your project root:

```jsonc
{
  "apiKey": "your_api_key",
  "userId": "your_user_id",
  "channel": "your_channel"
}
```

Priority order for all three fields: **project config** > **global config file** > **environment variables**

### Environment variables

Get your API key from [MemOS Dashboard](https://memos-dashboard.openmem.net/apikeys/), then set:

```bash
export MEMOS_API_KEY="your_api_key"
export MEMOS_USER_ID="your_user_id"
export MEMOS_CHANNEL="your_channel"
```

> **Tip**: Add these to your shell config (e.g., `~/.bashrc` or `~/.zshrc`) for persistence.

### Global config file

Optionally, you can also use a global config file at `~/.config/opencode/mem-os.jsonc` (or `memos.jsonc` for backwards compatibility):

```jsonc
{
  "apiKey": "your_api_key",
  "userId": "your_user_id",
  "channel": "your_channel",
  "baseUrl": "https://memos.memtensor.cn/api/openmem/v1"
}
```

Optional settings (via global config or env var):

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMOS_BASE_URL` | MemOS default | API URL |

### Debug Mode

Enable debug mode to see detailed logs of configuration loading and API requests:

```jsonc
{
  "apiKey": "your_api_key",
  "userId": "your_user_id",
  "channel": "your_channel",
  "debug": true
}
```

Debug output includes:
- Which config file was loaded and from which path
- Configuration priority resolution
- All API requests and responses
- Detailed error information

Debug logs are written to `~/.config/opencode/.opencode-memos.log` and printed to stderr.

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
