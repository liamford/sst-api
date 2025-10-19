/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const isProd = input.stage === 'prod2';
    return {
      name: 'backend',
      removal: isProd ? 'retain' : 'remove',
      protect: isProd,
      home: 'aws',
    };
  },
  async run() {
    const stacks = require('./stacks');

    return {
      apigw: stacks.apigw.url,
      bucketArn: stacks.bucket.arn,
      tableName: stacks.table.name,
      webBucketName: stacks.webBucket.name,
      webCdnDomain: stacks.distribution.domainName,
      amplifyAppId: stacks.amplifyApp.id,
    };
  },
});
