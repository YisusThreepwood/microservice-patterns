import { Context, SQSEvent, Callback } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = new AWS.DynamoDB({ apiVersion: '2012-08-10', region: 'eu-west-1' });

export const handler = (event: SQSEvent, context: Context, callback: Callback): void => {
  event.Records.forEach(message => {
    const input = JSON.parse(message.body);
    dynamodb.putItem({
      Item: {
        'id': { S: uuidv4() },
        'action': { S: input.action },
        'userId': { S: input.userId },
      },
      TableName: 'UserActions',
    }, err => {
      if (err) console.log(err, err.stack);
    });
  });

  callback(null, {
    statusCode: 200,
    body: JSON.stringify({
      message: 'User action registered successfully',
    }),
  });
};