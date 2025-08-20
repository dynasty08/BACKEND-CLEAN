@echo off
echo Setting up hybrid DynamoDB + PostgreSQL system...
echo.

echo 1. Installing dependencies...
npm install

echo.
echo 2. Deploying to AWS...
serverless deploy

echo.
echo 3. Setting up PostgreSQL tables...
timeout /t 5 /nobreak > nul
curl -X GET "https://u5su0afn4h.execute-api.ap-southeast-1.amazonaws.com/dev/setup-postgresql"

echo.
echo 4. Syncing existing DynamoDB data to PostgreSQL...
timeout /t 3 /nobreak > nul
curl -X GET "https://u5su0afn4h.execute-api.ap-southeast-1.amazonaws.com/dev/sync-data"

echo.
echo ✅ Hybrid setup complete!
echo.
echo Available endpoints:
echo - POST /login (DynamoDB only)
echo - POST /login/hybrid (Both databases)
echo - POST /logout (DynamoDB only)  
echo - POST /logout/hybrid (Both databases)
echo - GET /dashboard (DynamoDB only)
echo - GET /dashboard/hybrid (Both databases)
echo - GET /reset-sessions (Manual session reset)
echo.
echo ⏰ Automatic daily session reset: Every day at midnight UTC
echo.
pause