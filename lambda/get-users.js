const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    // Scan DynamoDB table
    const result = await docClient.send(new ScanCommand({
      TableName: process.env.USERS_TABLE
    }));

    // Remove password from each user
    const users = result.Items.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        users: users,
        count: users.length
      })
    };

  } catch (error) {
    console.error('Get users error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};
