import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";
import { Pool } from "pg";

import {
  hashPassword,
  isUsablePassword,
  isUsableUsername,
} from "../lib/auth/password";

function parseArgs(argv: string[]) {
  let username = "";
  let password = "";
  let name = "";
  let role: UserRole = "EDITOR";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--username") {
      username = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--password") {
      password = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--name") {
      name = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--role") {
      const value = argv[index + 1];
      if (value === "OWNER" || value === "EDITOR" || value === "VIEWER") {
        role = value;
      }
      index += 1;
    }
  }

  return { username, password, name, role };
}

async function main() {
  const { username, password, name, role } = parseArgs(process.argv.slice(2));

  if (!isUsableUsername(username)) {
    throw new Error("Need --username (2-32 letters, numbers, . _ -)");
  }

  if (!isUsablePassword(password)) {
    throw new Error("Need --password (8-128 characters)");
  }

  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/physics_question_bank?schema=public";
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const passwordHash = await hashPassword(password);
  const displayName = name.trim() || username;
  const email = `${username}@teachers.local`;

  try {
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash, name: displayName, role },
      create: {
        username,
        email,
        name: displayName,
        role,
        passwordHash,
      },
    });
    process.stdout.write(`${user.username}\n`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unable to create teacher";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
