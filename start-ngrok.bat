@echo off
cd /d "%~dp0"
echo ============================================================
echo   Orbit TV - javni link za drugove (preko ngrok)
echo ============================================================
echo.
echo VAZNO: Orbit TV server mora vec da radi (npm start ili
echo start-hidden.vbs) PRE nego sto pokrenes ovo.
echo.
echo Za par sekundi ispod ce se pojaviti red koji pocinje sa
echo "Forwarding" - link posle toga (https://....ngrok-free.app)
echo je ono sto posaljes drugu.
echo.
echo Ostavi ovaj prozor OTVOREN dok god drug gleda. Kad ga
echo zatvoris, link prestaje da radi.
echo ============================================================
echo.
ngrok http 3000
pause
