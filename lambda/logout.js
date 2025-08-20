const AWS = require('aws-sdk');

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

    // Get current user
    const userResult = await docClient.get({
      TableName: usersTable,
      Key: { userId: userId }
    }).promise();

    if (!userResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const user = userResult.Item;
    const sessions = user.sessions || [];
    
    // Deactivate the specific session
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

    // Update user record
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