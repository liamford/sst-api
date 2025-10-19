/// <reference path="../.sst/platform/config.d.ts" />

import { cognito } from '@pulumi/aws';
import { appConfig } from './config';



const userPool = new sst.aws.CognitoUserPool(`${appConfig.name}-user-pool`, {
  transform: {
    userPool: (args) => {
      // Use email as the actual username field to avoid alias-related email format restrictions
      args.usernameAttributes = ['email'];
      // Enable email verification
      args.autoVerifiedAttributes = ['email'];
      // Configure email verification using verificationMessageTemplate
      args.verificationMessageTemplate = {
        defaultEmailOption: 'CONFIRM_WITH_CODE',
        emailMessage: 'Your verification code is {####}',
        emailSubject: 'Your verification code',
      };
      // Enable device remembering to support "Remember this device" in Hosted UI (helps implement "Remember me" UX)
      args.deviceConfiguration = {
        // Do not challenge on new device by default; rely on standard auth flows/MFA if enabled
        challengeRequiredOnNewDevice: false,
        // Only remember device when user chooses to (Hosted UI shows a checkbox)
        deviceOnlyRememberedOnUserPrompt: true,
      };
      // Define custom attributes at creation time. Note: Updating schema on an existing User Pool is restricted by Cognito
      // and may require creating a new pool. Ensure this stack is applied when creating the pool, or plan a migration.

      args.schemas = [
        {
          name: 'avatar',
          attributeDataType: 'String',
          mutable: true,
          required: false,
        } as any,
      ];

    },
  },
});

// Create a domain for the hosted UI
const userPoolDomain = new cognito.UserPoolDomain(`${appConfig.name}-user-pool-domain`, {
  userPoolId: userPool.id,
  domain: `${appConfig.name}-auth`,
});

type Stage = keyof typeof appConfig.auth.callbacks;
const stage = $app.stage as Stage;
const callbacks = appConfig.auth.callbacks[stage] ?? [];
const logouts = appConfig.auth.logouts[stage] ?? [];

const poolClient = userPool.addClient('Web', {
  transform: {
    client: (args) => {
      args.explicitAuthFlows = ['ALLOW_USER_SRP_AUTH', 'ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'];
      // Enable hosted UI
      args.supportedIdentityProviders = ['COGNITO'];
      args.callbackUrls = callbacks;
      args.logoutUrls = logouts;
      args.allowedOauthFlows = appConfig.auth.oauthFlows as any;
      args.allowedOauthScopes = appConfig.auth.oauthScopes as any;
      args.allowedOauthFlowsUserPoolClient = true;
      // Allow the client to read/write the custom avatar attribute (requires the attribute to exist in the pool schema)

      args.readAttributes = ['email', 'name', 'custom:avatar'] as any;
      args.writeAttributes = ['email', 'name', 'custom:avatar'] as any;

      // Configure token lifetimes from config
      args.tokenValidityUnits = {
        accessToken: 'hours',
        idToken: 'hours',
        refreshToken: 'days',
      } as any; // type compat for Pulumi/SST
      args.accessTokenValidity = appConfig.auth.tokenValidity.accessHours;
      args.idTokenValidity = appConfig.auth.tokenValidity.idHours;
      args.refreshTokenValidity = appConfig.auth.tokenValidity.refreshDays;
    },
  },
});

// Create user groups
const standardGroup = new cognito.UserGroup(`${appConfig.name}-standard-group`, {
  userPoolId: userPool.id,
  name: 'standard',
  description: 'Standard users group',
  precedence: 2,
});

const adminGroup = new cognito.UserGroup(`${appConfig.name}-admin-group`, {
  userPoolId: userPool.id,
  name: 'admin',
  description: 'Admin users group',
  precedence: 1,
});

export { userPool, poolClient, userPoolDomain, standardGroup, adminGroup };
