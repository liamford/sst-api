# Serverless Backend (SST v3)

This project is an AWS serverless backend built with SST v3 and TypeScript. It provisions and connects the following services:

- API Gateway (HTTP API) with JWT authorizer via Amazon Cognito
- Lambda functions (Node.js/TypeScript via SST)
- DynamoDB (users table)
- S3 buckets (general app bucket and static web hosting)
- AWS Step Functions (rewards workflow)
- CloudFront (CDN in front of the hosted static site)

Key outputs after deployment include the API URL, S3 bucket names, DynamoDB table name, CloudFront domain, and the Amplify App ID (for the hosted frontend).


## Repository layout

- sst.config.ts — SST app configuration and outputs
- stacks/ — Infrastructure-as-code stacks (API, Cognito, DynamoDB, S3, Step Functions, Hosting)
- src/infra/functions/ — Lambda function handlers
- src/domain/ — Domain-level use cases
- src/config/env.ts — Environment variable loader
- .env.example — Example of local env vars


## Prerequisites

- Node.js 18+
- AWS credentials configured locally with permission to deploy the resources used by this project. Any of the following work:
  - AWS SSO or IAM user with programmatic access
  - Environment variables (AWS_PROFILE, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY)
  - The AWS CLI configured (aws configure sso or aws configure)
- An AWS account and a selected AWS region to deploy into

Notes:
- By default, SST reads the region from your AWS profile or environment. You can also set AWS_REGION in your env.
- Stages are logical environments (e.g., dev, production) that SST uses to namespace resources.


## Environment variables

Copy .env.example to .env and fill in values relevant to your local development session.

Minimal variables you may want to set locally:

- NODE_ENV=development
- PORT=3000 (only used by certain local tools; SST primarily controls ports for the dev dashboard)
- AWS_REGION=<your-region> (optional if profile already specifies region)
- STAGE=dev (your desired default stage)

Cognito-related and JWT secrets are provisioned and/or used by infrastructure and functions; keep secrets out of version control and only place locally required entries in .env. Do not commit .env.


## Install dependencies

- Ensure you have the SST CLI installed globally from sst.dev and available as the sst command.
- If needed, install project dependencies using your preferred package manager. The steps below only use the sst command.

SST will install the AWS provider if needed during dev/deploy.


## Build

SST compiles and bundles your Lambda functions automatically during dev and deploy. If you want to perform a type check locally (optional):

- tsc --noEmit

Optional: Lint/format with Biome if desired (requires Biome installed globally):

- biome check --apply .


## Run locally (SST Dev)

SST provides a live development environment that deploys minimal scaffolding and proxies requests to your local Lambdas when possible.

- sst dev

What you get:
- Live API endpoint printed in the console
- Automatic rebuild on code changes
- Logs and invocation tracing

If you prefer to specify a stage explicitly:

- sst dev --stage dev

Ensure your AWS credentials are active in your shell before running.


## Deploy

You can deploy to any named stage. Common choices are dev and production. Resources are logically namespaced by stage.

- Deploy to dev:
  - sst deploy --stage dev

- Deploy to production:
  - sst deploy --stage production

On success, SST will print outputs similar to:
- apigw: https://xxxxxx.execute-api.<region>.amazonaws.com
- bucketArn: arn:aws:s3:::...
- tableName: <dynamodb-table-name>
- webBucketName: <static-site-bucket>
- webCdnDomain: <cloudfront-domain>
- amplifyAppId: <amplify-app-id>

Save these for your client app or operational docs.


## Remove (tear down)

To delete all resources in a stage:

- sst remove --stage dev
- sst remove --stage production

Use with care. Removing production resources is irreversible unless you have backups. Note: removal/protection behaviors can be adjusted in sst.config.ts; in this project removal is currently set to "remove" and protect=false for all stages.


## Endpoints and functions

Defined in stacks/apigw.ts:

- POST /users — src/infra/functions/user-info.handler
  - Requires Cognito JWT (authorizer). Writes to S3 and DynamoDB
- GET /users — src/infra/functions/get-users.handler
  - Requires Cognito JWT (authorizer). Scans DynamoDB
- POST /users/{uetr}/process — src/infra/functions/process-uetr.handler
  - Starts the rewards Step Functions workflow

Environment passed to Lambdas includes bucket and table names; see stacks/apigw.ts for details.


## Cognito auth

- A User Pool and an App Client are created in stacks/cognito.ts.
- The API Gateway routes are configured with a JWT authorizer bound to the created pool and client.
- Obtain tokens from your login flow against the User Pool to call protected endpoints.


## Troubleshooting

- Credentials: Ensure your terminal session is authenticated (AWS SSO or valid profile) before running sst dev/deploy.
- Region mismatches: Verify AWS_REGION and your AWS profile point to the same region used for deployment.
- Stages: If resources seem missing, confirm you are using the same stage as previously deployed.
- Permissions: Functions have scoped IAM permissions. Review stacks/apigw.ts if an action is denied.
- Clean deploy: If dev infra is in a bad state, try sst remove --stage dev then redeploy.
- State bucket is missing error: If you see "The state bucket is missing, it may have been accidentally deleted", open the AWS Console link to Systems Manager Parameter Store and inspect the key `/sst/bootstrap`:
  - Go to: https://console.aws.amazon.com/systems-manager/parameters/%252Fsst%252Fbootstrap/description?tab=Table
  - Check the bucket name listed there. In S3, verify that bucket exists in the same region.
  - If the bucket was deleted, either recreate it with the exact name, or delete the `/sst/bootstrap` parameter to let SST recreate state on the next run.
  - After fixing, run `sst dev` or `sst deploy` again. To prevent this in the future, avoid deleting the SST state bucket and keep region/stage consistent across runs.


## Common SST commands

- sst --version — Print the installed SST CLI version
- sst help — Show CLI help and available commands
- sst dev [--stage <name>] — Start the live dev environment
- sst deploy --stage <name> — Deploy the app to a stage (e.g., dev, production)
- sst remove --stage <name> — Tear down all resources for a stage
- sst outputs [--stage <name>] — Print CloudFormation/Pulumi outputs for a stage
- sst console — Open the SST Console (if supported for your provider/version)

Tip: You can omit --stage if you export STAGE in your environment or set it in .env.


## FAQ

Q: Do I need to build manually before deploy?
A: No. SST handles build/bundle during dev and deploy.

Q: How do I customize removal/protection for production?
A: Update sst.config.ts. For example, set removal: "retain" and protect: true when input.stage is "production".

Q: Where do I configure environment variable access for functions?
A: See stacks/apigw.ts and src/config/env.ts. Pass env vars in the stack and read them in code.


## License

MIT