const AWS = require('aws-sdk');
const db = require('../utils/database');

const docClient = new AWS.DynamoDB.DocumentClient();
const usersTable = 'DynamoDB-CLEAN';

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, sessionId } = body;

    if (!userId || !sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'userId and sessionId are required'
        })
      };
    }

    // Update session in both databases
    await Promise.all([
      updateDynamoDBLogout(userId, sessionId),
      updatePostgreSQLLogout(userId, sessionId)
    ]);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Logout successful'
      })
    };

  } catch (error) {
    console.error('Logout error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Logout failed: ' + error.message
      })
    };
  }
};

async function updateDynamoDBLogout(userId, sessionId) {
  try {
    const userResult = await docClient.get({
      TableName: usersTable,
      Key: { userId: userId }
    }).promise();

    if (userResult.Item) {
      const sessions = userResult.Item.sessions || [];
      const updatedSessions = sessions.map(session => {
        if (session.sessionId === sessionId) {
          return {
            ...session,
            isActive: false,
            logoutTime: new Date().toISOString()
          };
        }
        return session;
      });

      const activeSessions = updatedSessions.filter(s => s.isActive);
      const isCurrentlyActive = activeSessions.length > 0;

      await docClient.update({
        TableName: usersTable,
        Key: { userId: userId },
        UpdateExpression: 'SET sessions = :sessions, activeSessions = :activeSessions, isCurrentlyActive = :isCurrentlyActive',
        ExpressionAttributeValues: {
          ':sessions': updatedSessions,
          ':activeSessions': activeSessions.length,
          ':isCurrentlyActive': isCurrentlyActive
        }
      }).promise();
    }
  } catch (error) {
    console.warn('DynamoDB logout error:', error.message);
  }
}

async function updatePostgreSQLLogout(userId, sessionId) {
  try {
    // Deactivate session
    await db.query(
      'UPDATE user_sessions SET is_active = false, logout_time = $1 WHERE session_id = $2',
      [new Date(), sessionId]
    );
    
    // Update user active status
    const activeSessionsResult = await db.query(
      'SELECT COUNT(*) FROM user_sessions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    
    const activeCount = parseInt(activeSessionsResult.rows[0].count);
    
    await db.query(
      'UPDATE users SET is_currently_active = $1, active_sessions = $2, updated_at = $3 WHERE user_id = $4',
      [activeCount > 0, activeCount, new Date(), userId]
    );
  } catch (error) {
    console.warn('PostgreSQL logout error:', error.message);
  }
}