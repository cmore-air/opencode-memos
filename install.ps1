#!/usr/bin/env pwsh

$PLUGIN_NAME = "opencode-memos"
$REPO = "cmore-air/opencode-memos"
$OPENCODE_CONFIG_DIR = Join-Path $env:USERPROFILE ".config/opencode"
$OPENCODE_CONFIG_JSON = Join-Path $OPENCODE_CONFIG_DIR "opencode.json"
$OPENCODE_CONFIG_JSONC = Join-Path $OPENCODE_CONFIG_DIR "opencode.jsonc"
$INSTALL_DIR = Join-Path $OPENCODE_CONFIG_DIR "plugins/opencode-memos"
$COMMAND_DIR = Join-Path $OPENCODE_CONFIG_DIR "command"

if (Test-Path $OPENCODE_CONFIG_JSON) {
    $OPENCODE_CONFIG = $OPENCODE_CONFIG_JSON
} elseif (Test-Path $OPENCODE_CONFIG_JSONC) {
    $OPENCODE_CONFIG = $OPENCODE_CONFIG_JSONC
} else {
    $OPENCODE_CONFIG = $OPENCODE_CONFIG_JSON
}

Write-Host "Installing opencode-memos plugin..."

# Create directories
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $OPENCODE_CONFIG_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $COMMAND_DIR | Out-Null

# Clone or update plugin
if (Test-Path (Join-Path $INSTALL_DIR ".git")) {
    Write-Host "Plugin exists, updating..."
    Set-Location $INSTALL_DIR
    git pull --force
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun install
        bun run build
    } else {
        Write-Host "Warning: bun not found, skipping build."
    }
} else {
    Write-Host "Downloading plugin..."
    git clone --depth 1 "https://github.com/$REPO" $INSTALL_DIR
    Set-Location $INSTALL_DIR
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun install
        bun run build
    } else {
        Write-Host "Warning: bun not found, skipping build."
    }
}

# Register plugin in opencode.json
$PLUGIN_PATH = "file:///$($INSTALL_DIR -replace '\\', '/')"

if (Test-Path $OPENCODE_CONFIG) {
    if (Select-String -Path $OPENCODE_CONFIG -Pattern "opencode-memos" -Quiet) {
        Write-Host "Plugin already registered in config"
    } else {
        $configContent = Get-Content $OPENCODE_CONFIG -Raw
        try {
            $config = $configContent -replace '(?m)^\s*//.*$' -replace '(?s)/\*.*?\*/' | ConvertFrom-Json
        } catch {
            $config = @{ plugin = @() }
        }
        if (-not $config.plugin) {
            $config | Add-Member -NotePropertyName "plugin" -NotePropertyValue @() -Force
        }
        if (-not ($config.plugin -contains $PLUGIN_PATH)) {
            $config.plugin += $PLUGIN_PATH
        }
        $config | ConvertTo-Json -Depth 10 | Set-Content $OPENCODE_CONFIG
        Write-Host "Added plugin to config"
    }
} else {
    $config = @{ plugin = @($PLUGIN_PATH) }
    $config | ConvertTo-Json -Depth 10 | Set-Content $OPENCODE_CONFIG
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

Set-Content -Path (Join-Path $COMMAND_DIR "mem-os-init.md") -Value $initContent
Set-Content -Path (Join-Path $COMMAND_DIR "mem-os-help.md") -Value $helpContent

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
