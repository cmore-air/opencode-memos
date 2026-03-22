#!/usr/bin/env pwsh

$PLUGIN_NAME = "opencode-memos"
$REPO = "cmore-air/opencode-memos"
$INSTALL_DIR = "$HOME/.config/opencode/plugins/opencode-memos"
$OPENCODE_CONFIG_DIR = "$HOME/.config/opencode"
$OPENCODE_CONFIG = "$OPENCODE_CONFIG_DIR/opencode.jsonc"
$COMMAND_DIR = "$OPENCODE_CONFIG_DIR/command"

Write-Host "Installing opencode-memos plugin..."

# Create directories
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $OPENCODE_CONFIG_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $COMMAND_DIR | Out-Null

# Clone or update plugin
if (Test-Path "$INSTALL_DIR/.git") {
    Write-Host "Updating plugin..."
    Set-Location $INSTALL_DIR
    git pull
} else {
    Write-Host "Downloading plugin..."
    git clone --depth 1 "https://github.com/$REPO" $INSTALL_DIR
}

# Install dependencies
Set-Location $INSTALL_DIR
if (Get-Command bun -ErrorAction SilentlyContinue) {
    bun install
    bun run build
} else {
    Write-Host "Warning: bun not found, skipping build. Install bun first."
}

# Register plugin in opencode.jsonc
$PLUGIN_PATH = "file:///$INSTALL_DIR"

if (Test-Path $OPENCODE_CONFIG) {
    $content = Get-Content $OPENCODE_CONFIG -Raw
    if ($content -match "opencode-memos") {
        Write-Host "Plugin already registered in config"
    } else {
        @{
            plugin = @($PLUGIN_PATH)
        } | ConvertTo-Json | Set-Content $OPENCODE_CONFIG
        Write-Host "Added plugin to config"
    }
} else {
    @{
        plugin = @($PLUGIN_PATH)
    } | ConvertTo-Json | Set-Content $OPENCODE_CONFIG
    Write-Host "Created config with plugin"
}

# Create commands
$initContent = @"
---
description: Initialize mem-os with comprehensive codebase knowledge
---

# Initializing mem-os

You are initializing persistent memory for this codebase using mem-os...
"@

$helpContent = @"
---
description: Get help with mem-os memory plugin
---

# mem-os Help

mem-os provides persistent memory for OpenCode agents.
"@

Set-Content -Path "$COMMAND_DIR/mem-os-init.md" -Value $initContent
Set-Content -Path "$COMMAND_DIR/mem-os-help.md" -Value $helpContent

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Set your MemOS credentials:"
Write-Host '   $env:MEMOS_API_KEY = "your_api_key"'
Write-Host '   $env:MEMOS_USER_ID = "your_user_id"'
Write-Host '   $env:MEMOS_CHANNEL = "your_channel"'
Write-Host ""
Write-Host "2. Restart OpenCode to activate the plugin"
Write-Host ""
