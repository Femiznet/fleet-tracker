import fs from 'node:fs';
import path from 'node:path';

const DRIZZLE_DIR = path.join(process.cwd(), 'drizzle');
const DB_SQL_DIR = path.join(process.cwd(), 'src', 'backend');
const JOURNAL_PATH = path.join(DRIZZLE_DIR, 'meta', '_journal.json');

type JournalEntry = {
  idx: number;
  tag: string;
};

type Journal = {
  entries: JournalEntry[];
};

type SqlSource = {
  directory: string;
  marker: string;
  appendOnce: boolean;
};

const SQL_SOURCES: SqlSource[] = [
  { directory: path.join(DB_SQL_DIR, 'db-migrations'), marker: 'Migration SQL', appendOnce: true },
  { directory: path.join(DB_SQL_DIR, 'db-functions'), marker: 'Function', appendOnce: false },
];

function appendDbSqlToLatestMigration() {
  if (!fs.existsSync(JOURNAL_PATH)) {
    throw new Error('Could not find drizzle/meta/_journal.json. Run drizzle-kit generate first.');
  }

  const journal: Journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf-8'));
  const latestEntry = journal.entries.at(-1);

  if (!latestEntry) {
    throw new Error('No migration entries found in _journal.json.');
  }

  const targetSqlPath = path.join(DRIZZLE_DIR, `${latestEntry.tag}.sql`);
  if (!fs.existsSync(targetSqlPath)) {
    throw new Error(`Could not find the latest migration file: ${targetSqlPath}`);
  }

  const existingSql = fs.readFileSync(targetSqlPath, 'utf-8').trimEnd();
  const migrationHistory = journal.entries
    .map(({ tag }) => {
      const migrationPath = path.join(DRIZZLE_DIR, `${tag}.sql`);
      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Could not find migration file listed in the journal: ${migrationPath}`);
      }

      return fs.readFileSync(migrationPath, 'utf-8');
    })
    .join('\n');

  const pendingSql = SQL_SOURCES.flatMap(({ directory, marker, appendOnce }) => {
    const existingSourceSql = appendOnce ? migrationHistory : existingSql;
    if (!fs.existsSync(directory)) {
      return [];
    }

    return fs
      .readdirSync(directory)
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .flatMap((file) => {
        const sqlMarker = `-- ${marker}: ${file}`;
        if (existingSourceSql.includes(sqlMarker)) {
          return [];
        }

        const content = fs.readFileSync(path.join(directory, file), 'utf-8').trim();
        return [`${sqlMarker}\n${content}`];
      });
  });

  if (pendingSql.length === 0) {
    console.log(`No new db-migrations/ or db-functions/ SQL to append to ${latestEntry.tag}.sql.`);
    return;
  }

  const appendedSql = pendingSql.join('\n--> statement-breakpoint\n');
  const updatedSql = `${existingSql}\n--> statement-breakpoint\n${appendedSql}\n`;
  fs.writeFileSync(targetSqlPath, updatedSql, 'utf-8');

  console.log(`Appended ${pendingSql.length} SQL files from db-migrations/ and db-functions/ into ${latestEntry.tag}.sql`);
}

console.log('Appending database SQL...');
appendDbSqlToLatestMigration();
