/// <reference path="../.sst/platform/config.d.ts" />

import { poolClient, userPool } from './cognito';
import { appConfig } from './config';
import { table } from './dynamo';
import { bucket } from './s3';
import { rewardsStateMachine } from './step-functions';
import { lambda } from './utils/lambda';

const apigw = new sst.aws.ApiGatewayV2(`${appConfig.name}-api`, {
  cors: true,
  accessLog: {
    retention: '1 day',
  },
  transform: {
    api: {
      name: `${appConfig.name}-api`,
    },
    stage: {
      name: $app.stage,
      autoDeploy: true,
    },
  },
});

const authorizer = apigw.addAuthorizer({
  name: 'myCognitoAuthorizer',
  jwt: {
    issuer: $interpolate`https://cognito-idp.${aws.getRegionOutput().name}.amazonaws.com/${userPool.id}`,
    audiences: [poolClient.id],
  },
});

const environment = {
  BUCKET_NAME: bucket.name,
  TABLE_NAME: table.name,
};

apigw.route(
  'POST /users',
  lambda({
    handler: 'src/infra/functions/user-info.handler',
    environment,
    timeout: appConfig.runtime.defaultTimeout,
    permissions: [
      {
        actions: ['s3:PutObject'],
        effect: 'allow',
        resources: [bucket.arn.apply((arn) => `${arn}/*`)],
      },
      {
        actions: ['dynamodb:PutItem'],
        effect: 'allow',
        resources: [table.arn],
      },
    ],
  }),
  {
    auth: {
      jwt: {
        authorizer: authorizer.id,
      },
    },
  },
);

apigw.route(
  'GET /users',
  lambda({
    handler: 'src/infra/functions/get-users.handler',
    environment,
    timeout: appConfig.runtime.defaultTimeout,
    permissions: [
      {
        actions: ['dynamodb:Scan'],
        effect: 'allow',
        resources: [table.arn],
      },
    ],
  }),
  {
    auth: {
      jwt: {
        authorizer: authorizer.id,
      },
    },
  },
);

apigw.route(
  'POST /users/{uetr}/process',
  lambda({
    handler: 'src/infra/functions/process-uetr.handler',
    environment: {
      USERS_TABLE_NAME: table.name,
      USERS_TABLE_PK: 'uetr',
      REWARDS_STATE_MACHINE_ARN: rewardsStateMachine.arn,
    },
    timeout: appConfig.runtime.defaultTimeout,
    permissions: [
      {
        actions: ['dynamodb:GetItem'],
        effect: 'allow',
        resources: [table.arn],
      },
      {
        actions: ['states:StartExecution'],
        effect: 'allow',
        resources: [rewardsStateMachine.arn],
      },
    ],
  }),
);

export { apigw };
