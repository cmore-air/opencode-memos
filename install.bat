@echo off
setlocal

set PLUGIN_NAME=opencode-memos
set REPO=cmore-air/opencode-memos
set INSTALL_DIR=%USERPROFILE%\.config\opencode\plugins\opencode-memos
set OPENCODE_CONFIG_DIR=%USERPROFILE%\.config\opencode
set OPENCODE_CONFIG=%OPENCODE_CONFIG_DIR%\opencode.jsonc
set COMMAND_DIR=%OPENCODE_CONFIG_DIR%\command

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

:: Register plugin in opencode.jsonc
set PLUGIN_PATH=file:///%INSTALL_DIR%
set PLUGIN_PATH=%PLUGIN_PATH:\=/%

if exist "%OPENCODE_CONFIG%" (
    findstr /C:"opencode-memos" "%OPENCODE_CONFIG%" >nul 2>&1
    if not errorlevel 1 (
        echo Plugin already registered in config
    ) else (
        echo { "plugin": ["%PLUGIN_PATH%"] } > "%OPENCODE_CONFIG%"
        echo Added plugin to config
    )
) else (
    echo { "plugin": ["%PLUGIN_PATH%"] } > "%OPENCODE_CONFIG%"
    echo Created config with plugin
)

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
