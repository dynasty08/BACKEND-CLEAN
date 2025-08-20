const db = require('../utils/database');

exports.handler = async (event) => {
  try {
    console.log('📊 Fetching analytics data from PostgreSQL...');

    // Query complex data with JSONB operations
    const analyticsQuery = `
      SELECT 
        ua.user_id,
        ua.session_duration,
        ua.pages_visited,
        ua.actions_performed->>'clicks' as total_clicks,
        ua.actions_performed->'feature_usage' as feature_usage,
        ua.device_info->>'browser' as browser,
        ua.device_info->>'os' as operating_system,
        ua.location_data->>'country' as country,
        ua.created_at
      FROM user_analytics ua
      ORDER BY ua.created_at DESC
      LIMIT 10
    `;

    const processingJobsQuery = `
      SELECT 
        fpj.job_id,
        fpj.file_name,
        fpj.file_size,
        fpj.processing_status,
        fpj.processing_metadata->'processing_steps' as processing_steps,
        fpj.processing_metadata->'quality_metrics' as quality_metrics,
        fpj.processing_duration_seconds,
        fpj.cpu_usage_percent,
        fpj.created_at
      FROM file_processing_jobs fpj
      WHERE fpj.processing_status = 'completed'
      ORDER BY fpj.created_at DESC
      LIMIT 5
    `;

    const dailyReportsQuery = `
      SELECT 
        dr.report_date,
        dr.total_users,
        dr.active_users,
        dr.files_processed,
        dr.system_metrics->'cpu_usage'->>'avg' as avg_cpu_usage,
        dr.system_metrics->'memory_usage'->>'avg' as avg_memory_usage,
        dr.user_engagement_data->'session_duration'->>'avg' as avg_session_duration,
        dr.performance_metrics->'api_response_time'->>'avg' as avg_response_time
      FROM daily_reports dr
      ORDER BY dr.report_date DESC
      LIMIT 7
    `;

    // Execute queries
    const [analyticsResult, processingResult, reportsResult] = await Promise.all([
      db.query(analyticsQuery),
      db.query(processingJobsQuery),
      db.query(dailyReportsQuery)
    ]);

    // Advanced JSONB query - Find users with high engagement
    const highEngagementQuery = `
      SELECT 
        ua.user_id,
        ua.actions_performed->'feature_usage' as features_used,
        (ua.actions_performed->>'clicks')::int as click_count
      FROM user_analytics ua
      WHERE (ua.actions_performed->>'clicks')::int > 30
        AND ua.actions_performed->'feature_usage'->>'dashboard' IS NOT NULL
      ORDER BY (ua.actions_performed->>'clicks')::int DESC
    `;

    const highEngagementResult = await db.query(highEngagementQuery);

    const responseData = {
      user_analytics: analyticsResult.rows,
      processing_jobs: processingResult.rows,
      daily_reports: reportsResult.rows,
      high_engagement_users: highEngagementResult.rows,
      summary: {
        total_analytics_records: analyticsResult.rows.length,
        total_processing_jobs: processingResult.rows.length,
        total_daily_reports: reportsResult.rows.length,
        high_engagement_count: highEngagementResult.rows.length
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
        message: 'Analytics data retrieved successfully',
        data: responseData
      })
    };

  } catch (error) {
    console.error('Error fetching analytics:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to fetch analytics data'
      })
    };
  }
};