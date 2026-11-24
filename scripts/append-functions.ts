import { appendFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function main(): Promise<void> {
  const migrationDir = path.resolve('drizzle');
  const functionsDir = path.resolve('db-functions');
  const migrationFiles = (await readdir(migrationDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const migrationFile = migrationFiles[migrationFiles.length - 1];

  if (!migrationFile) {
    throw new Error(`No SQL migration found in ${migrationDir}`);
  }

  const functionFiles = (await readdir(functionsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (functionFiles.length === 0) {
    throw new Error(`No SQL function files found in ${functionsDir}`);
  }

  const statements = await Promise.all(
    functionFiles.map(async (file) => (await readFile(path.join(functionsDir, file), 'utf8')).trim())
  );

  await appendFile(
    path.join(migrationDir, migrationFile),
    `\n--> statement-breakpoint\n${statements.join('\n--> statement-breakpoint\n')}\n`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
