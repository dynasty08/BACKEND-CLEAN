const db = require('../utils/database');

exports.handler = async (event) => {
  try {
    console.log('Setting up PostgreSQL tables...');

    // Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_currently_active BOOLEAN DEFAULT false,
        active_sessions INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(user_id),
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        logout_time TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);

    // Processed files table
    await db.query(`
      CREATE TABLE IF NOT EXISTS processed_files (
        file_id VARCHAR(255) PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_size INTEGER,
        status VARCHAR(50) DEFAULT 'processing',
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(255) REFERENCES users(user_id)
      )
    `);

    console.log('PostgreSQL tables created successfully');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'PostgreSQL tables created successfully'
      })
    };

  } catch (error) {
    console.error('Error setting up PostgreSQL:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};