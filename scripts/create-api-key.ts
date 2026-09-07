import {
  createApiKeyPlaintext,
  hashApiKeyPlaintext,
  resolveCreatedApiKeyScopes,
} from "../lib/auth/api-key-policy";

function parseArgs(argv: string[]) {
  let name = "harness";
  let allowHighRisk = false;
  const extraScopes: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--i-understand-high-risk") {
      allowHighRisk = true;
      continue;
    }

    if (arg === "--name") {
      name = argv[index + 1] ?? name;
      index += 1;
      continue;
    }

    if (arg === "--scope") {
      const scope = argv[index + 1];

      if (scope) {
        extraScopes.push(scope);
      }

      index += 1;
    }
  }

  return { name, allowHighRisk, extraScopes };
}

export async function createApiKeyRecord(options: {
  name: string;
  allowHighRisk: boolean;
  extraScopes: string[];
  persist: (data: { name: string; keyHash: string; scopes: string[] }) => Promise<unknown>;
}) {
  const scopes = resolveCreatedApiKeyScopes({
    scopes:
      options.extraScopes.length > 0 ? options.extraScopes : undefined,
    allowHighRisk: options.allowHighRisk,
  });
  const token = createApiKeyPlaintext();
  const keyHash = hashApiKeyPlaintext(token);

  await options.persist({ name: options.name, keyHash, scopes });

  return { token, keyHash, scopes };
}

async function main() {
  const { name, allowHighRisk, extraScopes } = parseArgs(process.argv.slice(2));
  const { prisma } = await import("../lib/db/prisma");
  const result = await createApiKeyRecord({
    name,
    allowHighRisk,
    extraScopes,
    persist: (data) => prisma.apiKey.create({ data }),
  });

  process.stdout.write(`${result.token}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unable to create api key";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
