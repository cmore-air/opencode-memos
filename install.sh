#!/bin/bash
set -e

PLUGIN_NAME="opencode-memos"
REPO="cmore-air/opencode-memos"
INSTALL_DIR="$HOME/.config/opencode/plugins/opencode-memos"
OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_CONFIG_JSON="$OPENCODE_CONFIG_DIR/opencode.json"
OPENCODE_CONFIG_JSONC="$OPENCODE_CONFIG_DIR/opencode.jsonc"
COMMAND_DIR="$OPENCODE_CONFIG_DIR/command"

if [ -f "$OPENCODE_CONFIG_JSON" ]; then
    OPENCODE_CONFIG="$OPENCODE_CONFIG_JSON"
elif [ -f "$OPENCODE_CONFIG_JSONC" ]; then
    OPENCODE_CONFIG="$OPENCODE_CONFIG_JSONC"
else
    OPENCODE_CONFIG="$OPENCODE_CONFIG_JSON"
fi

echo "Installing opencode-memos plugin..."

# Clone or update plugin
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Updating plugin..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "Downloading plugin..."
    mkdir -p "$INSTALL_DIR"
    git clone --depth 1 "https://github.com/$REPO" "$INSTALL_DIR"
fi

# Register plugin in opencode.json
mkdir -p "$OPENCODE_CONFIG_DIR"

if [ -f "$OPENCODE_CONFIG" ]; then
    if grep -q "opencode-memos" "$OPENCODE_CONFIG"; then
        echo "Plugin already registered in config"
    else
        node -e "
const fs = require('fs');
const path = require('path');
const configPath = '$OPENCODE_CONFIG';
const installDir = path.resolve('$INSTALL_DIR');
const pluginPath = 'file://' + installDir.replace(/\\\\/g, '/').replace(/:/, '');
const content = fs.readFileSync(configPath, 'utf8');
let config;
try {
  const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  config = JSON.parse(stripped);
} catch {
  config = {};
}
if (!config.plugin) config.plugin = [];
if (!config.plugin.includes(pluginPath)) {
  config.plugin.push(pluginPath);
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Added plugin to config:', pluginPath);
"
    fi
else
    node -e "
const fs = require('fs');
const path = require('path');
const installDir = path.resolve('$INSTALL_DIR');
const pluginPath = 'file://' + installDir.replace(/\\\\/g, '/').replace(/:/, '');
fs.writeFileSync('$OPENCODE_CONFIG', JSON.stringify({ plugin: [pluginPath] }, null, 2));
console.log('Created config with plugin:', pluginPath);
"
fi

# Create commands
mkdir -p "$COMMAND_DIR"
cat > "$COMMAND_DIR/mem-os-init.md" << 'EOF'
---
description: Initialize mem-os with comprehensive codebase knowledge
---

# Initializing mem-os

You are initializing persistent memory for this codebase using mem-os...

EOF

cat > "$COMMAND_DIR/mem-os-help.md" << 'EOF'
---
description: Get help with mem-os memory plugin
---

# mem-os Help

mem-os provides persistent memory for OpenCode agents.

## Commands

- `/mem-os-init` - Initialize memory for a codebase
- `/mem-os-help` - Show this help message

EOF

echo ""
echo "✓ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Set your MemOS credentials:"
echo "   export MEMOS_API_KEY=\"your_api_key\""
echo "   export MEMOS_USER_ID=\"your_user_id\""
echo "   export MEMOS_CHANNEL=\"your_channel\""
echo ""
echo "2. Restart OpenCode to activate the plugin"
echo ""
