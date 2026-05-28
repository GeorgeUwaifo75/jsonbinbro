@echo off
echo ========================================
echo Fixing JSONBin Clone Installation
echo ========================================

echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Uninstalling problematic packages...
pip uninstall motor pymongo -y

echo.
echo Installing compatible versions...
pip install motor==3.1.1
pip install pymongo==4.5.0

echo.
echo Verifying installation...
python -c "from motor.motor_asyncio import AsyncIOMotorClient; print('Motor import successful!')"

echo.
echo ========================================
echo Fix complete! Starting server...
echo ========================================
echo.

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause