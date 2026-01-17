@echo off
setlocal

title genRTL (No Cache)

pushd %~dp0\..

:: Disable cache for testing
set VSCODE_DEV=1
set ELECTRON_RUN_AS_NODE=
.\scripts\code.bat --no-cached-data %*

popd

endlocal

