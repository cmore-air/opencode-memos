@echo off
setlocal

set PLUGIN_NAME=opencode-memos
set REPO=cmore-air/opencode-memos
set INSTALL_DIR=%USERPROFILE%\.config\opencode\plugins\opencode-memos
set OPENCODE_CONFIG_DIR=%USERPROFILE%\.config\opencode
set OPENCODE_CONFIG_JSON=%OPENCODE_CONFIG_DIR%\opencode.json
set OPENCODE_CONFIG_JSONC=%OPENCODE_CONFIG_DIR%\opencode.jsonc
set COMMAND_DIR=%OPENCODE_CONFIG_DIR%\command

if exist "%OPENCODE_CONFIG_JSON%" (
    set OPENCODE_CONFIG=%OPENCODE_CONFIG_JSON%
) else if exist "%OPENCODE_CONFIG_JSONC%" (
    set OPENCODE_CONFIG=%OPENCODE_CONFIG_JSONC%
) else (
    set OPENCODE_CONFIG=%OPENCODE_CONFIG_JSON%
)

echo Installing opencode-memos plugin...

:: Create directories
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%OPENCODE_CONFIG_DIR%" mkdir "%OPENCODE_CONFIG_DIR%"
if not exist "%COMMAND_DIR%" mkdir "%COMMAND_DIR%"

:: Clone or update plugin
if exist "%INSTALL_DIR%\.git" (
    echo Updating plugin...
    cd /d "%INSTALL_DIR%" && git pull
) else (
    echo Downloading plugin...
    git clone --depth 1 "https://github.com/%REPO%" "%INSTALL_DIR%"
)

:: Install dependencies
cd /d "%INSTALL_DIR%"
if exist "bun.exe" (
    call bun install
    call bun run build
) else (
    echo Warning: bun not found, skipping build. Install bun first.
)

:: Register plugin using PowerShell for reliable JSON handling
set PLUGIN_PATH=file:///%INSTALL_DIR%
set PLUGIN_PATH=%PLUGIN_PATH:\=/%

powershell -NoProfile -ExecutionPolicy Bypass -Command "
$configPath = '%OPENCODE_CONFIG%'
$pluginPath = '%PLUGIN_PATH%'
if (Test-Path $configPath) {
    if (Select-String -Path $configPath -Pattern 'opencode-memos' -Quiet) {
        Write-Host 'Plugin already registered in config'
    } else {
        try {
            $content = Get-Content $configPath -Raw
            $config = $content -replace '(?m)^\s*//.*$','' -replace '(?s)/\*.*?\*/','' | ConvertFrom-Json
            if (-not $config.plugin) { $config | Add-Member -NotePropertyName 'plugin' -NotePropertyValue @() -Force }
            if (-not ($config.plugin -contains $pluginPath)) { $config.plugin += $pluginPath }
            $config | ConvertTo-Json -Depth 10 | Set-Content $configPath
            Write-Host 'Added plugin to config'
        } catch {
            Write-Host 'Failed to update config'
        }
    }
} else {
    @{{ plugin = @($pluginPath) }} | ConvertTo-Json | Set-Content $configPath
    Write-Host 'Created config with plugin'
}
"

:: Create commands
echo --- > "%COMMAND_DIR%\mem-os-init.md"
echo description: Initialize mem-os with comprehensive codebase knowledge >> "%COMMAND_DIR%\mem-os-init.md"
echo --- >> "%COMMAND_DIR%\mem-os-init.md"
echo. >> "%COMMAND_DIR%\mem-os-init.md"
echo # Initializing mem-os >> "%COMMAND_DIR%\mem-os-init.md"
echo. >> "%COMMAND_DIR%\mem-os-init.md"
echo You are initializing persistent memory for this codebase using mem-os... >> "%COMMAND_DIR%\mem-os-init.md"

echo --- > "%COMMAND_DIR%\mem-os-help.md"
echo description: Get help with mem-os memory plugin >> "%COMMAND_DIR%\mem-os-help.md"
echo --- >> "%COMMAND_DIR%\mem-os-help.md"
echo. >> "%COMMAND_DIR%\mem-os-help.md"
echo # mem-os Help >> "%COMMAND_DIR%\mem-os-help.md"
echo. >> "%COMMAND_DIR%\mem-os-help.md"
echo mem-os provides persistent memory for OpenCode agents. >> "%COMMAND_DIR%\mem-os-help.md"

echo.
echo Installation complete!
echo.
echo Next steps:
echo 1. Set your MemOS credentials:
echo    set MEMOS_API_KEY=your_api_key
echo    set MEMOS_USER_ID=your_user_id
echo    set MEMOS_CHANNEL=your_channel
echo.
echo 2. Restart OpenCode to activate the plugin
echo.

endlocal
