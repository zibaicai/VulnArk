@echo off
rem Called by Task Scheduler: run in project root, append log
cd /d "%~dp0.."
vulnark.exe >> vulnark.log 2>&1
