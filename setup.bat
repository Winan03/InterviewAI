@echo off
echo ========================================
echo VozInterview - Quick Setup Script
echo ========================================
echo.

echo [1/4] Setting up Backend...
cd backend

echo Creating Python virtual environment...
python -m venv venv

echo Activating virtual environment...
call venv\Scripts\activate

echo Installing Python dependencies...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install Python dependencies
    echo If PyAudio fails, try:
    echo   pip install pipwin
    echo   pipwin install pyaudio
    pause
    exit /b 1
)

echo.
echo [2/4] Setting up Frontend...
cd ..\frontend

echo Installing Node dependencies...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install Node dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo Setup Complete! ✓
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Start Backend:
echo    cd backend
echo    venv\Scripts\activate
echo    python main.py
echo.
echo 2. Start Frontend (in new terminal):
echo    cd frontend
echo    npm run electron:dev
echo.
echo 3. Customize your profile in:
echo    backend\config.py
echo.
echo ========================================
pause
