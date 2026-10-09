import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { buildExpandedDataset } from './dataset.mjs';
import { renderPcBuilderExpansionMigration } from './generate.mjs';
import { validateDataset } from './validate.mjs';

const repo = new URL('../../', import.meta.url);
const migrations = readdirSync(new URL('supabase/migrations/', repo))
  .filter(name => name.endsWith('_pc_builder_catalog_expansion.sql'));
if (migrations.length !== 1) {
  throw new Error('Create exactly one migration with supabase migration new pc_builder_catalog_expansion');
}

const path = new URL(`supabase/migrations/${migrations[0]}`, repo);
const data = buildExpandedDataset();
const generated = renderPcBuilderExpansionMigration(data);
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== generated) {
    throw new Error('PC Builder expansion migration differs from deterministic source; regenerate');
  }
} else {
  writeFileSync(path, generated, 'utf8');
}

console.log({
  ...validateDataset(data),
  addedPcBuilderProducts: 32,
  optionsPerCategory: 8,
  migration: migrations[0],
  checked: process.argv.includes('--check'),
});
