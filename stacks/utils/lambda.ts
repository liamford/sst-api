/// <reference path="../../.sst/platform/config.d.ts" />

type Args = Omit<sst.aws.FunctionArgs, 'architecture' | 'nodejs' | 'runtime' | 'logging' | 'transform'>;

const getFunctionName = (handlerPath: string) => {
  // Extract function name from handler path like "src/infra/functions/user-info.handler"
  const handlerNameRegex = /.*\/(.+)\.handler$/;
  const match = handlerPath.match(handlerNameRegex);
  const functionName = match ? match[1] : 'unknown-function';
  // Convert kebab-case or snake_case to PascalCase for cleaner names
  const cleanName = functionName.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
  return `${cleanName}-function`;
};

export function lambda(args: Args): sst.aws.FunctionArgs {
  return {
    architecture: 'arm64',
    memory: '128 MB',
    runtime: 'nodejs22.x',
    nodejs: {
      esbuild: {
        bundle: true,
        minify: true,
        sourcemap: false,
        external: ['@aws-sdk/*'],
      },
    },
    logging: {
      retention: '1 week',
    },
    transform: {
      function: args.handler
        ? {
            name: $interpolate`${args.handler}`.apply((handlerPath) => getFunctionName(handlerPath)),
          }
        : undefined,
    },
    ...args,
  };
}
