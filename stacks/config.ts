export const appConfig = {
  name: 'backend',
  stages: ['dev', 'staging', 'prod'],
  tags: { system: 'rewards', owner: 'platform' },

  naming: {
    prefix: (stage: string) => `backend-${stage}`,
    dynamoTableBase: 'users',
    dynamoProductTableBase: 'products',
    apiBucketBase: 'api-uploads-bucket',
    webBucketBase: 'web-artifacts',
    cfDistComment: 'web static hosting',
  },

  cors: {
    apiBucket: {
      allowOrigins: ['http://localhost:5173'],
      allowHeaders: ['*'],
      allowMethods: ['PUT'] as const,
    },
    webBucket: {
      allowOrigins: ['*'],
      allowMethods: ['GET', 'HEAD'] as const,
      allowHeaders: ['*'],
    },
  },

  auth: {
    callbacks: {
      dev: ['http://localhost:3000/callback'],
      staging: ['https://staging.example.com/callback'],
      prod: ['https://app.example.com/callback'],
    },
    logouts: {
      dev: ['http://localhost:3000/logout'],
      staging: ['https://staging.example.com/logout'],
      prod: ['https://app.example.com/logout'],
    },
    oauthScopes: ['email', 'openid', 'profile'],
    oauthFlows: ['code'],
    enableAvatarSchema: false,
    enableAvatarClient: false,
    tokenValidity: { accessHours: 1, idHours: 1, refreshDays: 30 },
  },

  ssm: {
    pointsPerUser: '/app/rewards/points-per-user',
    creditCardSecret: '/app/rewards/credit-card-secret',
  },

  runtime: {
    defaultTimeout: '30 seconds',
  },
};
