const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const docClient = new AWS.DynamoDB.DocumentClient();
const usersTable = 'DynamoDB-CLEAN';

exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || 'unknown';
  
  try {
    // Log incoming request
    logger.info('Login attempt started', {
      requestId,
      method: event.httpMethod,
      path: event.path,
      userAgent: event.headers?.['User-Agent'],
      sourceIp: event.requestContext?.identity?.sourceIp
    });

    const body = JSON.parse(event.body || '{}');
    const { email, password } = body;

    logger.debug('Login request parsed', {
      requestId,
      email: email ? email.substring(0, 3) + '***' : 'missing',
      hasPassword: !!password
    });

    // Validate input
    if (!email || !password) {
      logger.warn('Login validation failed', {
        requestId,
        error: 'Missing email or password',
        hasEmail: !!email,
        hasPassword: !!password
      });
      
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

    // Find user by email
    const userResult = await docClient.query({
      TableName: usersTable,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }).promise();

    if (!userResult.Items || userResult.Items.length === 0) {
      logger.warn('Login failed - user not found', {
        requestId,
        email: email.substring(0, 3) + '***',
        sourceIp: event.requestContext?.identity?.sourceIp
      });
      
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

    const user = userResult.Items[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      logger.warn('Login failed - invalid password', {
        requestId,
        userId: user.userId,
        email: email.substring(0, 3) + '***',
        sourceIp: event.requestContext?.identity?.sourceIp
      });
      
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

    // Create session and update user record
    const sessionId = uuidv4();
    const newSession = {
      sessionId: sessionId,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isActive: true
    };
    
    // Get current user sessions
    const currentUser = await docClient.get({
      TableName: usersTable,
      Key: { userId: user.userId }
    }).promise();
    
    const existingSessions = currentUser.Item?.sessions || [];
    const updatedSessions = [...existingSessions, newSession];
    const activeSessions = updatedSessions.filter(s => s.isActive);
    
    // Update user with new session
    await docClient.update({
      TableName: usersTable,
      Key: { userId: user.userId },
      UpdateExpression: 'SET sessions = :sessions, totalSessions = :totalSessions, activeSessions = :activeSessions, lastLoginTime = :lastLoginTime, isCurrentlyActive = :isCurrentlyActive',
      ExpressionAttributeValues: {
        ':sessions': updatedSessions,
        ':totalSessions': updatedSessions.length,
        ':activeSessions': activeSessions.length,
        ':lastLoginTime': new Date().toISOString(),
        ':isCurrentlyActive': true
      }
    }).promise();

    logger.info('Login successful', {
      requestId,
      userId: user.userId,
      email: email.substring(0, 3) + '***',
      sessionId: sessionId,
      activeSessions: activeSessions.length,
      sourceIp: event.requestContext?.identity?.sourceIp
    });

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
          name: user.name
        },
        sessionId: sessionId
      })
    };

  } catch (error) {
    logger.error('Login function error', {
      requestId,
      error: error.message,
      stack: error.stack,
      sourceIp: event.requestContext?.identity?.sourceIp
    });
    
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