const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

async function createProcessedFilesTable() {
  try {
    // Create table
    const params = {
      TableName: 'ProcessedFiles-CLEAN',
      KeySchema: [
        {
          AttributeName: 'fileId',
          KeyType: 'HASH'
        }
      ],
      AttributeDefinitions: [
        {
          AttributeName: 'fileId',
          AttributeType: 'S'
        },
        {
          AttributeName: 'userId',
          AttributeType: 'S'
        }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'UserIdIndex',
          KeySchema: [
            {
              AttributeName: 'userId',
              KeyType: 'HASH'
            }
          ],
          Projection: {
            ProjectionType: 'ALL'
          }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    };

    await dynamodb.createTable(params).promise();
    console.log('✅ ProcessedFiles-CLEAN table created successfully');

    // Wait for table to be active
    await dynamodb.waitFor('tableExists', { TableName: 'ProcessedFiles-CLEAN' }).promise();
    console.log('✅ Table is now active');

    // Insert sample data
    const sampleFiles = [
      {
        fileId: uuidv4(),
        fileName: 'user-data.csv',
        fileSize: 2048,
        status: 'completed',
        processedAt: new Date().toISOString(),
        userId: 'user-123'
      },
      {
        fileId: uuidv4(),
        fileName: 'analytics.json',
        fileSize: 1536,
        status: 'processing',
        processedAt: new Date(Date.now() - 3600000).toISOString(),
        userId: 'user-456'
      },
      {
        fileId: uuidv4(),
        fileName: 'report.pdf',
        fileSize: 4096,
        status: 'completed',
        processedAt: new Date(Date.now() - 7200000).toISOString(),
        userId: 'user-789'
      },
      {
        fileId: uuidv4(),
        fileName: 'invoice.xlsx',
        fileSize: 3200,
        status: 'failed',
        processedAt: new Date(Date.now() - 10800000).toISOString(),
        userId: 'user-123'
      }
    ];

    for (const file of sampleFiles) {
      await docClient.put({
        TableName: 'ProcessedFiles-CLEAN',
        Item: file
      }).promise();
    }

    console.log('✅ Sample processed files data inserted');

  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log('✅ ProcessedFiles-CLEAN table already exists');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

createProcessedFilesTable();