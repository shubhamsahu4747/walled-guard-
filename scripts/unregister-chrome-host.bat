@echo off
echo ===================================================
echo   Unregistering Walled Guard Native Messaging Host
echo ===================================================

REG DELETE "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.walledguard.native" /f >nul 2>&1
REG DELETE "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.walledguard.native" /f >nul 2>&1

echo Native messaging host unregistered from Google Chrome and Microsoft Edge.
pause
