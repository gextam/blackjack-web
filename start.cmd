@echo off
cd /d "%~dp0"
start "" "http://localhost:8767/"
python -m http.server 8767 --bind 127.0.0.1
