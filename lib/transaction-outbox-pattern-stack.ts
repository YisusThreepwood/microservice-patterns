import {Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import {SqsEventSource, DynamoEventSource} from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import {StreamViewType} from 'aws-cdk-lib/aws-dynamodb';
import * as eventTarget from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';
import {
  Effect,
  ManagedPolicy,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import * as eventBridge from 'aws-cdk-lib/aws-events';

export class TransactionOutboxPatternStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userActionsTable = new dynamodb.Table(this, 'UserActionsTable', {
      tableName: 'UserActions',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      stream: StreamViewType.NEW_IMAGE,
    });

    const recordUserActionServiceRole = new Role(this, 'RecordUserActionServiceRole', {
      roleName: 'RecordUserActionServiceRole',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    recordUserActionServiceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
    );

    new Policy(this, 'RecordUserActionServicePolicy', {
      policyName: 'userActionsRepositoryWrite',
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['dynamodb:PutItem'],
            resources: [userActionsTable.tableArn],
          }),
        ],
      }),
      roles: [recordUserActionServiceRole],
    });

    const userActionSQS = new sqs.Queue(this, 'UserActionSQS', {
      queueName: 'user-action',
    });
    const recordUserActionService = new lambdaNode.NodejsFunction(this, 'RecordUserActionService', {
      functionName: 'RecordUserActionService',
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: path.join(__dirname, '/../src/record-user-action-service.ts'),
      timeout: Duration.seconds(15),
      role: recordUserActionServiceRole,
    });
    recordUserActionService.addEventSource(new SqsEventSource(userActionSQS, {
      batchSize: 10,
    }));

    const PublishNewUserActionRegisteredEventServiceRole = new Role(
      this,
      'PublishNewUserActionRegisteredEventServiceRole',
      {
        roleName: 'PublishNewUserActionRegisteredEventServiceRole',
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      },
    );
    PublishNewUserActionRegisteredEventServiceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
    );

    const userActionsEventBus = new eventBridge.EventBus(this, 'UserActionsEventBus', {
      eventBusName: 'user-actions',
    });

    new Policy(this, 'PublishNewUserActionRegisteredEventServiceRolePolicy', {
      policyName: 'PublishNewUserActionRegisteredEventServiceRolePolicy',
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['events:PutEvents'],
            resources: [userActionsEventBus.eventBusArn],
          }),
        ],
      }),
      roles: [recordUserActionServiceRole],
    });

    const PublishNewUserActionRegisteredEventService = new lambdaNode.NodejsFunction(
      this,
      'PublishNewUserActionRegisteredEventService',
      {
        functionName: 'PublishNewUserActionRegisteredEventService',
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: path.join(__dirname, '/../src/publish-new-user-action-registered-event-service.ts'),
        timeout: Duration.seconds(15),
        role: recordUserActionServiceRole,
      },
    );

    PublishNewUserActionRegisteredEventService.addEventSource(new DynamoEventSource(userActionsTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    }));

    const registeredUserActionSQS = new sqs.Queue(this, 'RegisteredUserActionSQS', {
      queueName: 'registered-user-action',
    });
    const completeAchievementService = new lambdaNode.NodejsFunction(this, 'CompleteAchievementService', {
      functionName: 'CompleteAchievementService',
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: path.join(__dirname, '/../src/complete-achievement-service.ts'),
      timeout: Duration.seconds(15),
    });
    completeAchievementService.addEventSource(new SqsEventSource(registeredUserActionSQS, {
      batchSize: 10,
    }));

    new eventBridge.Rule(this, 'NewUserActionRegisteredEventRule', {
      ruleName: 'NewUserActionRegistered',
      eventPattern: {
        detailType: ['NewUserActionRegistered'],
      },
      targets: [new eventTarget.SqsQueue(registeredUserActionSQS)],
      eventBus: userActionsEventBus,
    });
  }
}