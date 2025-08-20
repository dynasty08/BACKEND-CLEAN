const db = require('../utils/database');

exports.handler = async (event) => {
  try {
    console.log('🏗️ Setting up PostgreSQL database...');

    // Create tables
    const tables = [
      {
        name: 'user_analytics',
        sql: `CREATE TABLE IF NOT EXISTS user_analytics (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          session_duration INTEGER,
          pages_visited INTEGER DEFAULT 0,
          actions_performed JSONB,
          device_info JSONB,
          location_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'file_processing_jobs',
        sql: `CREATE TABLE IF NOT EXISTS file_processing_jobs (
          job_id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_size BIGINT,
          processing_status VARCHAR(50) DEFAULT 'pending',
          processing_metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'audit_logs',
        sql: `CREATE TABLE IF NOT EXISTS audit_logs (
          log_id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          request_data JSONB,
          response_data JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      }
    ];

    const results = [];
    for (const table of tables) {
      await db.query(table.sql);
      results.push(`✅ ${table.name} table created`);
    }

    // Insert sample data
    await db.query(`
      INSERT INTO user_analytics (user_id, session_duration, pages_visited, actions_performed, device_info)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [
      'user-123',
      1800,
      15,
      JSON.stringify({ clicks: 45, downloads: 2 }),
      JSON.stringify({ browser: 'Chrome', os: 'Windows' })
    ]);

    await db.query(`
      INSERT INTO file_processing_jobs (job_id, user_id, file_name, file_size, processing_status, processing_metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (job_id) DO NOTHING
    `, [
      'job-001',
      'user-123',
      'document.pdf',
      2048576,
      'completed',
      JSON.stringify({ pages: 10, quality: 'high' })
    ]);

    await db.query(`
      INSERT INTO audit_logs (user_id, action, resource_type, request_data, response_data)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'user-123',
      'file_upload',
      'file',
      JSON.stringify({ method: 'POST', endpoint: '/upload' }),
      JSON.stringify({ status: 200, message: 'success' })
    ]);

    results.push('✅ Sample data inserted');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Database setup completed',
        results: results
      })
    };

  } catch (error) {
    console.error('Setup error:', error);
    
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