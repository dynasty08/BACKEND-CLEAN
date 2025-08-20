const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let pool;
let dbCredentials;

const getDbCredentials = async () => {
  if (dbCredentials) return dbCredentials;
  
  const client = new SecretsManagerClient({ region: 'ap-southeast-1' });
  const secretArn = process.env.DB_SECRET_ARN || 'rds!db-498e9ad0-b353-492d-84bb-640ddffd016d';
  const command = new GetSecretValueCommand({ SecretId: secretArn });
  
  try {
    const response = await client.send(command);
    const secretData = JSON.parse(response.SecretString);
    
    // AWS-managed RDS secrets only have username/password, add connection details
    dbCredentials = {
      host: 'dynasty-database.cv646auk2i3w.ap-southeast-1.rds.amazonaws.com',
      port: 5432,
      dbname: 'dynastydatabase',
      username: secretData.username,
      password: secretData.password
    };
    
    return dbCredentials;
  } catch (error) {
    throw new Error(`Failed to retrieve database credentials: ${error.message}`);
  }
};

const getPool = async () => {
  if (pool) return pool;
  
  const credentials = await getDbCredentials();
  
  pool = new Pool({
    host: credentials.host,
    port: credentials.port || 5432,
    database: credentials.dbname,
    user: credentials.username,
    password: credentials.password,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  return pool;
};

module.exports = {
  query: async (text, params) => {
    const poolInstance = await getPool();
    return poolInstance.query(text, params);
  }
};