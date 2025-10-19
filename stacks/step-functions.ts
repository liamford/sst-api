/// <reference path="../.sst/platform/config.d.ts" />

import * as pulumi from '@pulumi/pulumi';
import { appConfig } from './config';
import { table } from './dynamo';
import { lambda } from './utils/lambda';

const toSsmArn = (paramPath: string) =>
  $interpolate`arn:aws:ssm:${aws.getRegionOutput().name}:${aws.getCallerIdentityOutput().accountId}:parameter${paramPath}`;

// Create the three Lambda functions for Step Functions tasks
export const addPointsFunction = new sst.aws.Function(
  'AddPointsFunction',
  lambda({
    handler: 'src/infra/functions/sfn-add-points.handler',
    environment: {
      POINTS_PARAM_NAME: appConfig.ssm.pointsPerUser,
    },
    permissions: [
      {
        actions: ['ssm:GetParameter'],
        effect: 'allow',
        resources: [toSsmArn(appConfig.ssm.pointsPerUser)],
      },
    ],
  }),
);

export const addCardFunction = new sst.aws.Function(
  'AddCardFunction',
  lambda({
    handler: 'src/infra/functions/sfn-add-card.handler',
    environment: {
      CC_PARAM_NAME: appConfig.ssm.creditCardSecret,
    },
    permissions: [
      {
        actions: ['ssm:GetParameter'],
        effect: 'allow',
        resources: [toSsmArn(appConfig.ssm.creditCardSecret)],
      },
      {
        actions: ['kms:Decrypt'],
        effect: 'allow',
        resources: ['*'], // Adjust to specific KMS key ARN if using customer-managed key
      },
    ],
  }),
);

export const updateUserFunction = new sst.aws.Function(
  'UpdateUserFunction',
  lambda({
    handler: 'src/infra/functions/sfn-update-user.handler',
    environment: {
      USERS_TABLE_NAME: table.name,
      USERS_TABLE_PK: 'uetr',
    },
    permissions: [
      {
        actions: ['dynamodb:UpdateItem'],
        effect: 'allow',
        resources: [table.arn],
      },
    ],
  }),
);

// Create IAM role for Step Functions
const stepFunctionsRole = new aws.iam.Role(`${appConfig.name}-step-functions-role`, {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'states.amazonaws.com',
        },
        Action: 'sts:AssumeRole',
      },
    ],
  }),
});

// Attach policy to allow Lambda invocation
new aws.iam.RolePolicy(`${appConfig.name}-step-functions-policy`, {
  role: stepFunctionsRole.id,
  policy: pulumi
    .all([addPointsFunction.arn, addCardFunction.arn, updateUserFunction.arn])
    .apply(([addPointsArn, addCardArn, updateUserArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'lambda:InvokeFunction',
            Resource: [addPointsArn, addCardArn, updateUserArn],
          },
        ],
      }),
    ),
});

// Create Step Functions state machine using Pulumi AWS
export const rewardsStateMachine = new aws.sfn.StateMachine('RewardsStateMachine', {
  name: `${appConfig.name}-rewards-state-machine`,
  roleArn: stepFunctionsRole.arn,
  definition: pulumi
    .all([addPointsFunction.arn, addCardFunction.arn, updateUserFunction.arn])
    .apply(([addPointsArn, addCardArn, updateUserArn]) =>
      JSON.stringify({
        Comment: 'Rewards pipeline: add points, add card, update user',
        StartAt: 'AddPoints',
        States: {
          AddPoints: {
            Type: 'Task',
            Resource: addPointsArn,
            Next: 'AddCreditCard',
            Retry: [
              {
                ErrorEquals: ['States.ALL'],
                IntervalSeconds: 2,
                MaxAttempts: 2,
                BackoffRate: 2.0,
              },
            ],
          },
          AddCreditCard: {
            Type: 'Task',
            Resource: addCardArn,
            Next: 'UpdateUser',
            Retry: [
              {
                ErrorEquals: ['States.ALL'],
                IntervalSeconds: 2,
                MaxAttempts: 2,
                BackoffRate: 2.0,
              },
            ],
          },
          UpdateUser: {
            Type: 'Task',
            Resource: updateUserArn,
            End: true,
            Retry: [
              {
                ErrorEquals: ['States.ALL'],
                IntervalSeconds: 2,
                MaxAttempts: 2,
                BackoffRate: 2.0,
              },
            ],
          },
        },
      }),
    ),
});
