@echo off
echo Manual CloudFormation Stack Fix
echo ================================

echo Step 1: Deleting the stuck stack...
aws cloudformation delete-stack --stack-name api-backend-2025-prod --region ap-southeast-1

echo Step 2: Waiting for deletion to complete (this may take a few minutes)...
aws cloudformation wait stack-delete-complete --stack-name api-backend-2025-prod --region ap-southeast-1

echo Step 3: Stack deleted successfully. Now deploying fresh...
serverless deploy --stage prod --region ap-southeast-1

echo Done! Your stack should now be deployed successfully.
pause