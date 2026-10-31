@echo off
setlocal
cd /d "%~dp0"

:: Look for Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%~dp0olto_notepad_core.html" --window-size=1120,740
    exit /b
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%~dp0olto_notepad_core.html" --window-size=1120,740
    exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="%~dp0olto_notepad_core.html" --window-size=1120,740
    exit /b
)

:: Look for Microsoft Edge (Pre-installed on every Windows 10/11 PC)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%~dp0olto_notepad_core.html" --window-size=1120,740
    exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%~dp0olto_notepad_core.html" --window-size=1120,740
    exit /b
)

:: Fallback to default system window handler
start "" "%~dp0olto_notepad_core.html"
exit /b
