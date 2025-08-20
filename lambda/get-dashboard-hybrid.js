const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const db = require('../utils/database');

const client = new DynamoDBClient({ region: 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    console.log('Starting hybrid dashboard data fetch...');
    
    // Get data from both databases
    const [dynamoData, postgresData] = await Promise.all([
      getDynamoDBData(),
      getPostgreSQLData()
    ]);

    const dashboardData = {
      totalUsers: dynamoData.totalUsers + postgresData.totalUsers,
      activeUsers: dynamoData.activeUsers + postgresData.activeUsers,
      activeSessions: dynamoData.activeSessions + postgresData.activeSessions,
      processedData: [...dynamoData.processedData, ...postgresData.processedData],
      dataSources: {
        dynamodb: {
          users: dynamoData.totalUsers,
          activeUsers: dynamoData.activeUsers,
          processedFiles: dynamoData.processedData.length
        },
        postgresql: {
          users: postgresData.totalUsers,
          activeUsers: postgresData.activeUsers,
          processedFiles: postgresData.processedData.length
        }
      }
    };

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
    console.error('Error fetching hybrid dashboard data:', error);
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

async function getDynamoDBData() {
  try {
    const [usersResult, activeUsersResult, filesResult] = await Promise.all([
      docClient.send(new ScanCommand({ TableName: 'DynamoDB-CLEAN', Select: 'COUNT' })),
      docClient.send(new ScanCommand({
        TableName: 'DynamoDB-CLEAN',
        FilterExpression: 'isCurrentlyActive = :isActive',
        ExpressionAttributeValues: { ':isActive': true },
        Select: 'COUNT'
      })),
      docClient.send(new ScanCommand({ TableName: 'ProcessedFiles-CLEAN', Limit: 5 }))
    ]);

    let activeSessions = 0;
    const allUsersResult = await docClient.send(new ScanCommand({
      TableName: 'DynamoDB-CLEAN',
      FilterExpression: 'isCurrentlyActive = :isActive',
      ExpressionAttributeValues: { ':isActive': true }
    }));
    
    allUsersResult.Items?.forEach(user => {
      activeSessions += user.activeSessions || 0;
    });

    return {
      totalUsers: usersResult.Count || 0,
      activeUsers: activeUsersResult.Count || 0,
      activeSessions,
      processedData: (filesResult.Items || []).map(file => ({
        id: file.fileId,
        type: 'file',
        status: file.status,
        processedAt: file.processedAt,
        source: 'DynamoDB',
        data: {
          fileName: file.fileName,
          fileSize: file.fileSize,
          userId: file.userId
        }
      }))
    };
  } catch (error) {
    console.warn('DynamoDB error:', error.message);
    return { totalUsers: 0, activeUsers: 0, activeSessions: 0, processedData: [] };
  }
}

async function getPostgreSQLData() {
  try {
    const [usersResult, activeUsersResult, sessionsResult, filesResult] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM users WHERE is_currently_active = true'),
      db.query('SELECT COUNT(*) FROM user_sessions WHERE is_active = true'),
      db.query('SELECT * FROM processed_files ORDER BY processed_at DESC LIMIT 5')
    ]);

    return {
      totalUsers: parseInt(usersResult.rows[0].count) || 0,
      activeUsers: parseInt(activeUsersResult.rows[0].count) || 0,
      activeSessions: parseInt(sessionsResult.rows[0].count) || 0,
      processedData: filesResult.rows.map(file => ({
        id: file.file_id,
        type: 'file',
        status: file.status,
        processedAt: file.processed_at,
        source: 'PostgreSQL',
        data: {
          fileName: file.file_name,
          fileSize: file.file_size,
          userId: file.user_id
        }
      }))
    };
  } catch (error) {
    console.warn('PostgreSQL error:', error.message);
    return { totalUsers: 0, activeUsers: 0, activeSessions: 0, processedData: [] };
  }
}