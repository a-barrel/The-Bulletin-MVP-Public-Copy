#!/usr/bin/env node

/**
 * Guardrail: ensure TODO-AND-IDEAS/ only contains the canonical folders/files.
 * This prevents stray docs from piling up at the root again.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const ideasRoot = path.join(repoRoot, 'TODO-AND-IDEAS');
const allowedEntries = new Set([
  '00-INDEX.md',
  '10-TODOS',
  '20-ROADMAPS',
  '30-AUDITS',
  '40-HANDOFFS',
  '90-ARCHIVE',
  'DEV_LOGS',
  'GENERALIZED-AUTOMATION'
]);

const isSystemFile = (name) =>
  name.startsWith('.') ||
  name.toLowerCase() === 'readme.md' ||
  name.toLowerCase() === '.ds_store';

function main() {
  if (!fs.existsSync(ideasRoot)) {
    return;
  }
  const entries = fs.readdirSync(ideasRoot, { withFileTypes: true });
  const offenders = entries
    .map((entry) => entry.name)
    .filter((name) => !isSystemFile(name))
    .filter((name) => !allowedEntries.has(name));

  if (offenders.length === 0) {
    return;
  }

  const list = offenders.map((name) => `  • ${name}`).join('\n');
  console.error(
    [
      '',
      '[todo-guard] The following entries live at TODO-AND-IDEAS/ but should be moved under the new taxonomy:',
      list,
      'Allowed root entries:',
      `  • ${Array.from(allowedEntries).join('\n  • ')}`,
      '',
      'Move the files into the appropriate folder (10-TODOS, 20-ROADMAPS, 30-AUDITS, 40-HANDOFFS, or 90-ARCHIVE) and update 00-INDEX.md.',
      ''
    ].join('\n')
  );
  process.exit(1);
}

main();
