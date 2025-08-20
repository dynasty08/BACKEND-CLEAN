# Serverless Backend with VPC Architecture

A comprehensive serverless backend with VPC, Lambda functions, API Gateway, DynamoDB, RDS, and S3 integration.

## Architecture Overview

```
S3 Bucket → Lambda Functions → DynamoDB
    ↓              ↓              ↓
    └──────→ RDS (MySQL) ←────────┘
```

**Flow**: S3 uploads trigger Lambda → Process data → Store in DynamoDB → Save processed data to RDS → Display in dashboard

## Prerequisites

1. **Node.js** (version 18 or higher)
2. **AWS CLI** configured with your credentials
3. **Serverless Framework** installed globally

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Install Serverless Framework globally
```bash
npm install -g serverless
```

### 3. Configure AWS Credentials
```bash
aws configure
```

### 4. AWS Secrets Manager Setup
The RDS password is automatically generated and stored in AWS Secrets Manager during deployment. No manual setup required.

### 4. Deploy to AWS
```bash
npm run deploy
```

## API Endpoints

### Authentication
- **POST /auth/register** - Register new user
- **POST /auth/login** - User login

### User Management
- **GET /users** - Get all users
- **GET /users/{id}** - Get user by ID with processed files

### Dashboard
- **GET /dashboard** - Get dashboard analytics

## Architecture Components

### VPC Configuration
- **Private Subnets**: Lambda functions and RDS in private subnets
- **No NAT Gateway**: Uses VPC endpoints for AWS services
- **VPC Endpoints**: S3, DynamoDB, and RDS endpoints

### Data Flow
1. **Registration**: Users register via Angular app → DynamoDB
2. **File Upload**: Files uploaded to S3 → Triggers Lambda
3. **Processing**: Lambda processes files → Updates DynamoDB → Saves to RDS
4. **Dashboard**: Frontend displays data from RDS

## Manual Function Addition

To add new Lambda functions and API Gateway endpoints:

```bash
npm run add-function
```

This interactive script will:
- Create handler file
- Add function to serverless.yml
- Configure API Gateway endpoint

## Example Usage

### Register User
```bash
curl -X POST https://your-api-url/dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'
```

### Login
```bash
curl -X POST https://your-api-url/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "password123"}'
```

### Upload File to S3 (triggers processing)
```bash
aws s3 cp user-data.json s3://your-bucket-name/
```

### Get Dashboard Data
```bash
curl https://your-api-url/dev/dashboard
```

## Project Structure

```
├── handlers/
│   ├── auth.js         # Authentication functions
│   ├── files.js        # File processing functions
│   ├── users.js        # User management functions
│   └── dashboard.js    # Dashboard analytics
├── scripts/
│   └── add-function.js # Script to add new functions
├── serverless.yml      # Complete infrastructure configuration
├── package.json        # Dependencies
└── README.md          # This file
```

## Database Schema

### DynamoDB (Users Table)
- **userId** (Primary Key)
- **email** (GSI)
- **name**, **password**, **status**, **createdAt**, **processedAt**

### RDS MySQL (Processed Files)
```sql
CREATE TABLE processed_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_key VARCHAR(255),
  user_id VARCHAR(255),
  content TEXT,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Features

- **VPC Isolation**: All resources in private subnets
- **No Internet Gateway**: Uses VPC endpoints only
- **Security Groups**: Restrictive access between services
- **Password Hashing**: bcrypt for user passwords
- **JWT Tokens**: For authentication

## Monitoring

```bash
# View logs
serverless logs -f processFile

# View specific function logs
serverless logs -f register --tail
```

## Cleanup

```bash
npm run remove
```

**Note**: This will delete all AWS resources including data in DynamoDB and RDS.