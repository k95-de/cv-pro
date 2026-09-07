@echo off
REM Double-click this file to preview the interactive CV.
REM It starts a tiny local web server and opens your browser.
cd /d "%~dp0"
start "" http://localhost:5555
python -m http.server 5555
