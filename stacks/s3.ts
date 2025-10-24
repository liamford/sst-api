/// <reference path="../.sst/platform/config.d.ts" />

import { appConfig } from './config';

const name = `${appConfig.naming.prefix($app.stage)}-${appConfig.naming.apiBucketBase}`;

const bucket = new sst.aws.Bucket(name, {
  cors: appConfig.cors.apiBucket as any,
  transform: {
    bucket: {
      bucket: name,
      tags: appConfig.tags,
    },
  },
});

export { bucket };
