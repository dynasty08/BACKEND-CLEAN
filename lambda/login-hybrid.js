const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../utils/database');

const docClient = new AWS.DynamoDB.DocumentClient();
const usersTable = 'DynamoDB-CLEAN';

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = body;

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Email and password are required'
        })
      };
    }

    // Try to find user in DynamoDB first
    let user = await findUserInDynamoDB(email);
    let userSource = 'DynamoDB';
    
    // If not found in DynamoDB, try PostgreSQL
    if (!user) {
      user = await findUserInPostgreSQL(email);
      userSource = 'PostgreSQL';
    }

    if (!user) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid email or password'
        })
      };
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid email or password'
        })
      };
    }

    const sessionId = uuidv4();
    
    // Update user session in both databases
    await Promise.all([
      updateDynamoDBSession(user.userId, sessionId),
      updatePostgreSQLSession(user.userId, sessionId)
    ]);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Login successful',
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          source: userSource
        },
        sessionId: sessionId
      })
    };

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Login failed: ' + error.message
      })
    };
  }
};

async function findUserInDynamoDB(email) {
  try {
    const result = await docClient.query({
      TableName: usersTable,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email }
    }).promise();
    
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    console.warn('DynamoDB query error:', error.message);
    return null;
  }
}

async function findUserInPostgreSQL(email) {
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        userId: row.user_id,
        email: row.email,
        name: row.name,
        password: row.password
      };
    }
    return null;
  } catch (error) {
    console.warn('PostgreSQL query error:', error.message);
    return null;
  }
}

async function updateDynamoDBSession(userId, sessionId) {
  try {
    const newSession = {
      sessionId: sessionId,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isActive: true
    };
    
    const currentUser = await docClient.get({
      TableName: usersTable,
      Key: { userId: userId }
    }).promise();
    
    if (currentUser.Item) {
      const existingSessions = currentUser.Item.sessions || [];
      const updatedSessions = [...existingSessions, newSession];
      const activeSessions = updatedSessions.filter(s => s.isActive);
      
      await docClient.update({
        TableName: usersTable,
        Key: { userId: userId },
        UpdateExpression: 'SET sessions = :sessions, totalSessions = :totalSessions, activeSessions = :activeSessions, lastLoginTime = :lastLoginTime, isCurrentlyActive = :isCurrentlyActive',
        ExpressionAttributeValues: {
          ':sessions': updatedSessions,
          ':totalSessions': updatedSessions.length,
          ':activeSessions': activeSessions.length,
          ':lastLoginTime': new Date().toISOString(),
          ':isCurrentlyActive': true
        }
      }).promise();
    }
  } catch (error) {
    console.warn('DynamoDB update error:', error.message);
  }
}

async function updatePostgreSQLSession(userId, sessionId) {
  try {
    // Insert new session
    await db.query(
      'INSERT INTO user_sessions (session_id, user_id, login_time, last_activity, is_active) VALUES ($1, $2, $3, $4, $5)',
      [sessionId, userId, new Date(), new Date(), true]
    );
    
    // Update user active status
    const activeSessionsResult = await db.query(
      'SELECT COUNT(*) FROM user_sessions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    
    await db.query(
      'UPDATE users SET is_currently_active = true, active_sessions = $1, updated_at = $2 WHERE user_id = $3',
      [parseInt(activeSessionsResult.rows[0].count), new Date(), userId]
    );
  } catch (error) {
    console.warn('PostgreSQL update error:', error.message);
  }
}