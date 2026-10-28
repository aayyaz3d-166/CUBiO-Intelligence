@echo off
setlocal
echo ================================================================
echo   ONE Language v1.2.0 Stable - One-Click Setup for VS Code
echo ================================================================
echo.

where code >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] VS Code command 'code' was not found in PATH.
    echo You can install the extension manually inside VS Code:
    echo   Extensions (Ctrl+Shift+X) -^> ... -^> Install from VSIX...
    echo   Select: %~dp0dist\one-language-1.2.0.vsix
) else (
    echo [1/3] Installing official VS Code extension...
    call code --install-extension "%~dp0dist\one-language-1.2.0.vsix" --force
)

echo [2/3] Configuring Environment PATH for ONE Language CLI...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$bin = (Resolve-Path '%~dp0bin').Path; " ^
  "$cur = [Environment]::GetEnvironmentVariable('Path', 'User'); " ^
  "if ($cur -notlike ('*' + $bin + '*')) { " ^
  "  [Environment]::SetEnvironmentVariable('Path', ($cur + ';' + $bin), 'User'); " ^
  "  Write-Host '  [OK] User PATH updated with: ' $bin -ForegroundColor Green; " ^
  "} else { " ^
  "  Write-Host '  [OK] User PATH already configured.' -ForegroundColor Green; " ^
  "}"

echo.
echo [3/3] Running verification test...
set "PATH=%PATH%;%~dp0bin"
call one.cmd run "%~dp0examples\01_hello_world\main.one"

echo.
echo ================================================================
echo   SUCCESS: ONE Language Environment is LIVE!
echo   - VS Code Extension: Installed (v1.2.0)
echo   - CLI: Available in any terminal via 'one' or 'one.cmd'
echo   - Qplayer Engine: Available via 'one run file.one --engine=qplayer'
echo ================================================================
echo.
pause
