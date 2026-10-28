@echo off
REM ONE Language Developer CLI Launcher
IF EXIST "%~dp0one.exe" (
  "%~dp0one.exe" %*
) ELSE (
  node "%~dp0one.cjs" %*
)
