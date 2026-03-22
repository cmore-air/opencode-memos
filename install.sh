#!/bin/bash
set -e

PLUGIN_NAME="opencode-memos"
REPO="cmore-air/opencode-memos"
INSTALL_DIR="$HOME/.config/opencode/plugins/opencode-memos"
OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/opencode.jsonc"
COMMAND_DIR="$OPENCODE_CONFIG_DIR/command"

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

# Install dependencies
cd "$INSTALL_DIR"
if command -v bun &> /dev/null; then
    bun install
    bun run build
else
    echo "Warning: bun not found, skipping build. Install bun first."
fi

# Register plugin in opencode.jsonc
mkdir -p "$OPENCODE_CONFIG_DIR"
PLUGIN_PATH="file://$INSTALL_DIR"

if [ -f "$OPENCODE_CONFIG" ]; then
    if grep -q "opencode-memos" "$OPENCODE_CONFIG"; then
        echo "Plugin already registered in config"
    else
        if grep -q '"plugin"' "$OPENCODE_CONFIG"; then
            sed -i "s/\"plugin\": \[/\"plugin\": [\n    \"$PLUGIN_PATH\",/" "$OPENCODE_CONFIG"
        else
            echo '{"plugin": ["'"$PLUGIN_PATH"'"]}' > "$OPENCODE_CONFIG"
        fi
        echo "Added plugin to config"
    fi
else
    echo '{"plugin": ["'"$PLUGIN_PATH"'"]}' > "$OPENCODE_CONFIG"
    echo "Created config with plugin"
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
