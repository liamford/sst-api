/// <reference path="../.sst/platform/config.d.ts" />

import * as aws from '@pulumi/aws';
import { appConfig } from './config';

// Create SSM parameters for the rewards system
export const pointsParameter = new aws.ssm.Parameter('RewardsPointsParameter', {
  name: '/app/rewards/points-per-user',
  type: 'String',
  value: appConfig.ssm.pointsPerUser,
  description: 'Default points to add per user in rewards system',
});

export const creditCardParameter = new aws.ssm.Parameter('CreditCardSecretParameter', {
  name: '/app/rewards/credit-card-secret',
  type: 'SecureString',
  value: appConfig.ssm.creditCardSecret,
  description: 'Secure credit card information for rewards system',
});
