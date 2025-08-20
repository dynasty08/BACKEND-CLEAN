@echo off
echo Deploying logout functionality...
echo.

echo Installing dependencies...
npm install

echo.
echo Deploying to AWS...
serverless deploy

echo.
echo Deployment complete!
echo New endpoint available: POST /logout
echo.
pause