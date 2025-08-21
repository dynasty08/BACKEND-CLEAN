@echo off
echo Checking CloudFormation stack status...

REM Check current stack status
aws cloudformation describe-stacks --stack-name api-backend-2025-prod --region ap-southeast-1 --query "Stacks[0].StackStatus" --output text > stack_status.txt 2>nul

if %errorlevel% neq 0 (
    echo Stack does not exist. Proceeding with deployment...
    goto deploy
)

set /p STACK_STATUS=<stack_status.txt
echo Current stack status: %STACK_STATUS%

if "%STACK_STATUS%"=="UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS" (
    echo Stack is in cleanup state. Waiting for cleanup to complete...
    aws cloudformation wait stack-update-rollback-complete --stack-name api-backend-2025-prod --region ap-southeast-1
    echo Cleanup completed.
)

if "%STACK_STATUS%"=="UPDATE_ROLLBACK_COMPLETE" (
    echo Stack is in rollback complete state. Deleting stack...
    aws cloudformation delete-stack --stack-name api-backend-2025-prod --region ap-southeast-1
    echo Waiting for stack deletion...
    aws cloudformation wait stack-delete-complete --stack-name api-backend-2025-prod --region ap-southeast-1
    echo Stack deleted successfully.
)

:deploy
echo Deploying serverless application...
serverless deploy --stage prod --region ap-southeast-1

del stack_status.txt 2>nul
echo Done!
pause