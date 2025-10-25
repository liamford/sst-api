/// <reference path="../.sst/platform/config.d.ts" />

import { appConfig } from './config';

// Existing API uploads bucket (fixed name)
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

const picturesBaseName = `${appConfig.naming.prefix($app.stage)}-pictures`;
const picturesBucket = new sst.aws.Bucket(picturesBaseName, {
  cors: appConfig.cors.apiBucket as any,
  transform: {
    bucket: {
      tags: appConfig.tags,
    },
  },
});

export { bucket, picturesBucket };