@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Registering Walled Guard Native Messaging Host
echo ===================================================

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR:~0,-8%"
set "HOST_JSON=%ROOT_DIR%\extension\com.walledguard.native.json"
set "BAT_PATH=%SCRIPT_DIR%native-host.bat"

:: Escape backslashes for JSON
set "ESCAPED_BAT_PATH=%BAT_PATH:\=\\%"

echo Updating host manifest at: %HOST_JSON%
(
  echo {
  echo   "name": "com.walledguard.native",
  echo   "description": "Walled Guard DLP Native Messaging Host",
  echo   "path": "!ESCAPED_BAT_PATH!",
  echo   "type": "stdio",
  echo   "allowed_origins": [
  echo     "chrome-extension://jcbcffpofhmgdhgklfpkdkokojkkgjnf/"
  echo   ]
  echo }
) > "%HOST_JSON%"

echo.
echo Registering in Windows Registry for Google Chrome...
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.walledguard.native" /ve /t REG_SZ /d "%HOST_JSON%" /f

echo.
echo Registering in Windows Registry for Microsoft Edge...
REG ADD "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.walledguard.native" /ve /t REG_SZ /d "%HOST_JSON%" /f

echo.
echo ===================================================
echo   Registration Complete!
echo.
echo   1. Open Chrome or Edge.
echo   2. Go to chrome://extensions or edge://extensions
echo   3. Enable "Developer mode".
echo   4. Click "Load unpacked" and select the folder:
echo      %ROOT_DIR%\extension
echo.
echo   The extension ID will be: jcbcffpofhmgdhgklfpkdkokojkkgjnf
echo ===================================================
pause
