const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    console.log('Starting real-time dashboard data fetch...');
    
    // Get total users from DynamoDB
    const usersResult = await docClient.send(new ScanCommand({
      TableName: 'DynamoDB-CLEAN',
      Select: 'COUNT'
    }));
    const totalUsers = usersResult.Count || 0;
    console.log('Total users:', totalUsers);

    // Get currently active users (users with active sessions)
    const activeUsersResult = await docClient.send(new ScanCommand({
      TableName: 'DynamoDB-CLEAN',
      FilterExpression: 'isCurrentlyActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': true
      },
      Select: 'COUNT'
    }));
    const activeUsers = activeUsersResult.Count || 0;
    console.log('Currently active users:', activeUsers);

    // Get total active sessions from all users
    let activeSessions = 0;
    try {
      const allUsersResult = await docClient.send(new ScanCommand({
        TableName: 'DynamoDB-CLEAN',
        FilterExpression: 'isCurrentlyActive = :isActive',
        ExpressionAttributeValues: {
          ':isActive': true
        }
      }));
      
      allUsersResult.Items?.forEach(user => {
        activeSessions += user.activeSessions || 0;
      });
    } catch (sessionError) {
      console.warn('Error counting active sessions:', sessionError.message);
      activeSessions = 0;
    }
    console.log('Total active sessions:', activeSessions);

    // Get real processed files from DynamoDB
    let processedFiles = [];
    try {
      const filesResult = await docClient.send(new ScanCommand({
        TableName: 'ProcessedFiles-CLEAN',
        Limit: 10
      }));
      processedFiles = filesResult.Items || [];
    } catch (filesError) {
      console.warn('ProcessedFiles table not ready, using empty array:', filesError.message);
      processedFiles = [];
    }
    console.log('Processed files count:', processedFiles.length);

    const dashboardData = {
      totalUsers,
      activeUsers,
      activeSessions,
      processedData: processedFiles.map(file => ({
        id: file.fileId,
        type: 'file',
        status: file.status,
        processedAt: file.processedAt,
        data: {
          fileName: file.fileName,
          fileSize: file.fileSize,
          userId: file.userId
        }
      }))
    };

    console.log('Real-time dashboard data prepared');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch dashboard data: ' + error.message
      })
    };
  }
};