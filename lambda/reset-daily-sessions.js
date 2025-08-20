const AWS = require('aws-sdk');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const db = require('../utils/database');

const docClient = new AWS.DynamoDB.DocumentClient();
const client = new DynamoDBClient({ region: 'ap-southeast-1' });
const newDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    console.log('Starting daily session reset...');
    
    let resetCount = 0;
    
    // Reset DynamoDB sessions
    const usersResult = await newDocClient.send(new ScanCommand({
      TableName: 'DynamoDB-CLEAN'
    }));
    
    for (const user of usersResult.Items || []) {
      if (user.sessions && user.sessions.length > 0) {
        const updatedSessions = user.sessions.map(session => ({
          ...session,
          isActive: false,
          logoutTime: session.logoutTime || new Date().toISOString()
        }));
        
        await docClient.update({
          TableName: 'DynamoDB-CLEAN',
          Key: { userId: user.userId },
          UpdateExpression: 'SET sessions = :sessions, activeSessions = :activeSessions, isCurrentlyActive = :isCurrentlyActive',
          ExpressionAttributeValues: {
            ':sessions': updatedSessions,
            ':activeSessions': 0,
            ':isCurrentlyActive': false
          }
        }).promise();
        
        resetCount++;
      }
    }
    
    // Reset PostgreSQL sessions
    try {
      await db.query('UPDATE user_sessions SET is_active = false, logout_time = $1 WHERE is_active = true', [new Date()]);
      await db.query('UPDATE users SET is_currently_active = false, active_sessions = 0, updated_at = $1', [new Date()]);
    } catch (pgError) {
      console.warn('PostgreSQL reset error:', pgError.message);
    }
    
    console.log(`Daily session reset completed. Reset ${resetCount} users.`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Daily session reset completed. Reset ${resetCount} users.`,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Daily reset error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};