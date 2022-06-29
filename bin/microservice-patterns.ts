#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TransactionOutboxPatternStack } from '../lib/transaction-outbox-pattern-stack';

const app = new cdk.App();
new TransactionOutboxPatternStack(app, 'TransactionOutboxPatternStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});