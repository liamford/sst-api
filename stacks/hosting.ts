/// <reference path="../.sst/platform/config.d.ts" />

import { amplify, cloudfront, s3 } from '@pulumi/aws';
import { appConfig } from './config';

// S3 bucket to receive build artifacts from an external pipeline
const webBucket = new sst.aws.Bucket(`${appConfig.name}-web-artifacts`, {
  // Keep bucket private; CloudFront will read via OAC
  access: 'cloudfront',
  cors: appConfig.cors.webBucket,
});

// CloudFront Origin Access Control (OAC) to securely sign requests to S3
const oac = new cloudfront.OriginAccessControl(`${appConfig.name}-oac`, {
  name: `${appConfig.name}-oac`,
  description: `${appConfig.name} OAC for web artifacts`,
  originAccessControlOriginType: 's3',
  signingBehavior: 'always',
  signingProtocol: 'sigv4',
});

// CloudFront distribution in front of the S3 bucket
const distribution = new cloudfront.Distribution(`${appConfig.name}-web-cdn`, {
  enabled: true,
  comment: appConfig.naming.cfDistComment,
  defaultRootObject: 'index.html',
  origins: [
    {
      originId: 's3-origin',
      domainName: s3.getBucketOutput({ bucket: webBucket.name }).bucketRegionalDomainName,
      originAccessControlId: oac.id,
      s3OriginConfig: { originAccessIdentity: '' },
    },
  ],
  defaultCacheBehavior: {
    targetOriginId: 's3-origin',
    viewerProtocolPolicy: 'redirect-to-https',
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD'],
    compress: true,
    forwardedValues: {
      queryString: false,
      cookies: { forward: 'none' },
    },
  },
  priceClass: 'PriceClass_100',
  restrictions: {
    geoRestriction: {
      restrictionType: 'none',
    },
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
});

// Bucket policy is managed by the SST Bucket component (access: "cloudfront").

// Minimal Amplify App, primarily to satisfy request for Amplify presence.
// This does not connect to a repository; artifacts are expected to be uploaded to S3 by an external pipeline.
const amplifyApp = new amplify.App(`${appConfig.name}-amplify`, {
  name: `${appConfig.name}-amplify`,
  platform: 'WEB',
});

export { webBucket, distribution, amplifyApp };
