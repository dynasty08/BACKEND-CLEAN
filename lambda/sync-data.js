const AWS = require('aws-sdk');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const db = require('../utils/database');

const docClient = new AWS.DynamoDB.DocumentClient();
const client = new DynamoDBClient({ region: 'ap-southeast-1' });
const newDocClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    console.log('Starting data sync from DynamoDB to PostgreSQL...');

    // Sync users
    const usersResult = await docClient.scan({ TableName: 'DynamoDB-CLEAN' }).promise();
    let syncedUsers = 0;

    for (const user of usersResult.Items || []) {
      try {
        await db.query(`
          INSERT INTO users (user_id, email, name, password, is_currently_active, active_sessions, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id) DO UPDATE SET
            is_currently_active = EXCLUDED.is_currently_active,
            active_sessions = EXCLUDED.active_sessions,
            updated_at = CURRENT_TIMESTAMP
        `, [
          user.userId,
          user.email,
          user.name,
          user.password,
          user.isCurrentlyActive || false,
          user.activeSessions || 0,
          user.createdAt ? new Date(user.createdAt) : new Date()
        ]);

        // Sync user sessions
        if (user.sessions) {
          for (const session of user.sessions) {
            await db.query(`
              INSERT INTO user_sessions (session_id, user_id, login_time, logout_time, last_activity, is_active)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (session_id) DO UPDATE SET
                logout_time = EXCLUDED.logout_time,
                last_activity = EXCLUDED.last_activity,
                is_active = EXCLUDED.is_active
            `, [
              session.sessionId,
              user.userId,
              session.loginTime ? new Date(session.loginTime) : new Date(),
              session.logoutTime ? new Date(session.logoutTime) : null,
              session.lastActivity ? new Date(session.lastActivity) : new Date(),
              session.isActive || false
            ]);
          }
        }

        syncedUsers++;
      } catch (userError) {
        console.warn(`Error syncing user ${user.userId}:`, userError.message);
      }
    }

    // Sync processed files
    let syncedFiles = 0;
    try {
      const filesResult = await newDocClient.send(new ScanCommand({ TableName: 'ProcessedFiles-CLEAN' }));
      
      for (const file of filesResult.Items || []) {
        try {
          await db.query(`
            INSERT INTO processed_files (file_id, file_name, file_size, status, processed_at, user_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (file_id) DO UPDATE SET
              status = EXCLUDED.status,
              processed_at = EXCLUDED.processed_at
          `, [
            file.fileId,
            file.fileName,
            file.fileSize || 0,
            file.status || 'processing',
            file.processedAt ? new Date(file.processedAt) : new Date(),
            file.userId
          ]);
          syncedFiles++;
        } catch (fileError) {
          console.warn(`Error syncing file ${file.fileId}:`, fileError.message);
        }
      }
    } catch (filesError) {
      console.warn('Error syncing files:', filesError.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Data sync completed',
        results: {
          syncedUsers,
          syncedFiles
        }
      })
    };

  } catch (error) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Sync failed: ' + error.message
      })
    };
  }
};