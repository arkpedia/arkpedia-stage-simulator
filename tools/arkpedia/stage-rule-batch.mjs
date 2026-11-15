// SPDX-License-Identifier: GPL-3.0-or-later
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadContentContext, planStage } from './content-inventory.mjs';
import { createStageRuleImporter } from './stage-rule-receipt.mjs';
import { loadStageRuleReceipt, writeSharedStageRuleReceipt } from './stage-rule-storage.mjs';

/** Each binding is an independent commit. Failed downloads or unknown rules do
 * not publish content or prevent other evidence from being imported. */
export async function importStageRules({ root = ROOT, source, ids, apply = false, importer,
  concurrency = 4, refresh = false, onProgress = () => {} }) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw Error('Concurrency must be between 1 and 8');
  const queue = [...new Set(ids)], results = new Array(queue.length);
  let cursor = 0, completed = 0;
  let publication = Promise.resolve();
  const publish = fn => { const next = publication.then(fn); publication = next.catch(() => {}); return next; };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const position = cursor++, id = queue[position];
      let row;
      try {
        if (!/^[a-z0-9_-]+$/i.test(id)) throw Error('Invalid stage slug');
        const loaded = await loadStageRuleReceipt(root, id);
        if (loaded.receipt && !refresh) row = { id, status: 'existing' };
        else {
          const stage = JSON.parse(await readFile(join(source, 'stages', `${id}.json`)));
          if (stage.slug !== id) throw Error('Stage source identity mismatch');
          if (!stage.battle) row = { id, status: 'non-combat' };
          else if (!apply) row = { id, status: 'pending' };
          else {
            const result = await importer(stage);
            if (JSON.stringify(loaded.receipt) === JSON.stringify(result.receipt)) row = { id, status: 'existing' };
            else {
              await publish(() => writeSharedStageRuleReceipt(root, id, result.receipt,
                { replaceDigest: loaded.receipt ? loaded.sources[0].sha256 : null }));
              row = { id, status: loaded.receipt ? 'refreshed' : 'imported', rules: result.status,
                ...(result.blocker ? { blocker: result.blocker } : {}) };
            }
          }
        }
      } catch (error) { row = { id, status: 'failed', error: error.message }; }
      results[position] = row;
      onProgress({ completed: ++completed, total: queue.length, row });
    }
  }));
  const counts = {};
  for (const row of results) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return { scope: 'Original rule evidence only; no stage was admitted or published.', counts, results };
}

export async function runStageRuleBatch(args) {
  let limit = Infinity;
  const flags = new Set();
  for (const arg of args) {
    if (flags.has(arg)) throw Error('Duplicate option');
    flags.add(arg);
    if (/^--limit=[1-9]\d*$/.test(arg)) {
      if (limit !== Infinity) throw Error('Duplicate limit');
      limit = Number(arg.slice(8));
    } else if (!['--all', '--apply', '--global', '--refresh'].includes(arg))
      throw Error('Usage: npm run content:rules:batch -- [--all] [--limit=N] [--global] [--refresh] [--apply]');
  }
  const source = process.env.ARKPEDIA_CONTENT_SOURCE ? resolve(process.env.ARKPEDIA_CONTENT_SOURCE)
    : resolve(ROOT, '../arkpedia-data/source/data');
  const context = flags.has('--all') ? null : await loadContentContext({ source });
  const names = (await readdir(join(source, 'stages'))).filter(n => n.endsWith('.json')).sort();
  const ids = [];
  for (const name of names) {
    const id = name.slice(0, -5);
    if (context) {
      const plan = await planStage(context, id, { compile: false });
      if (!plan.combat || plan.blockers.some(b => !['stage-rules', 'conditional'].includes(b.kind))) continue;
    }
    // Existing bindings are validated by the worker rather than overwritten.
    // Limit applies to pending imports, making repeated small runs resumable.
    let existing = false;
    try { existing = !!(await loadStageRuleReceipt(ROOT, id)).receipt; } catch { /* report corrupt evidence below */ }
    if (existing && !flags.has('--refresh')) continue;
    const stage = JSON.parse(await readFile(join(source, 'stages', name)));
    if (!stage.battle) continue;
    ids.push(id);
    if (ids.length >= limit) break;
  }
  const apply = flags.has('--apply');
  const importer = apply && ids.length ? await createStageRuleImporter({ channel: flags.has('--global') ? 'global' : 'cn' }) : null;
  const report = await importStageRules({ root: ROOT, source, ids, apply, importer, refresh: flags.has('--refresh'),
    onProgress: ({ completed, total, row }) => {
      if (apply && (completed % 25 === 0 || completed === total)) console.error(`${completed}/${total}: ${row.id} (${row.status})`);
    } });
  console.log(JSON.stringify(report, null, 2));
  if (report.counts.failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runStageRuleBatch(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
