const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: 'DynamoDB-CLEAN',
      ProjectionExpression: 'userId, #name, email, createdAt',
      ExpressionAttributeNames: {
        '#name': 'name'
      }
    }));

    const users = result.Items || [];

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        users: users,
        count: users.length
      })
    };

  } catch (error) {
    console.error('Error fetching users:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch users: ' + error.message
      })
    };
  }
};