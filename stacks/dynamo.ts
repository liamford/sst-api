/// <reference path="../.sst/platform/config.d.ts" />

import { appConfig } from './config';

const tableName = `${appConfig.naming.prefix($app.stage)}-${appConfig.naming.dynamoTableBase}`;

export const table = new sst.aws.Dynamo(tableName, {
  fields: {
    uetr: 'string',
  },
  primaryIndex: { hashKey: 'uetr' },
  transform: {
    table: {
      name: tableName,
      billingMode: 'PAY_PER_REQUEST',
      tags: appConfig.tags,
    },
  },
});
