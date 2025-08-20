const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.USERS_TABLE || 'DynamoDB-CLEAN';

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Email, password, and name are required'
        })
      };
    }

    // Check if user already exists
    const existingUser = await dynamodb.query({
      TableName: tableName,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }).promise();

    if (existingUser.Items && existingUser.Items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'User with this email already exists'
        })
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Save user to DynamoDB
    await dynamodb.put({
      TableName: tableName,
      Item: {
        userId: userId,
        email: email,
        name: name,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      }
    }).promise();

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'User registered successfully',
        userId: userId
      })
    };

  } catch (error) {
    console.error('Registration error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Registration failed: ' + error.message
      })
    };
  }
};