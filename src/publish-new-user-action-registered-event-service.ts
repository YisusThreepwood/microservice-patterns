import * as AWS from 'aws-sdk';
import { DynamoDBStreamEvent } from 'aws-lambda/trigger/dynamodb-stream';
import { PutEventsRequestEntryList } from 'aws-sdk/clients/eventbridge';

const eventBridge = new AWS.EventBridge();

export const handler = (event: DynamoDBStreamEvent): void => {
  const events: PutEventsRequestEntryList = [];

  event.Records.forEach(record => {
    if (record.dynamodb?.NewImage && record.eventName == 'INSERT') {
      const userAction = record.dynamodb.NewImage;
      events.push({
        Detail: JSON.stringify({
          actionId: userAction.id.S,
          action: userAction.action.S,
          userId: userAction.userId.S,
        }),
        DetailType: 'NewUserActionRegistered',
        EventBusName: 'user-actions',
        Source: 'publish-new-user-action-registered-event-service',
      });
    }
  });

  if (events) {
    eventBridge.putEvents({
      Entries: events,
    }, err => {
      if (err) console.log(err, err.stack);
    });
  }
};