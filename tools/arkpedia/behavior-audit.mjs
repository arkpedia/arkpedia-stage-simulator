#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { actionName, compileBuffTemplate } from '../../shared/arkpedia/behavior.js';
import { REGULAR_OPERATORS } from '../../shared/arkpedia/operators.js';

/** Capability audit only: compiling an isolated buff does not support a skill,
 * its buff lifetime, targeting, animation timing or any containing operator. */
export function auditBehaviorTemplates(templates, { source, bindings }) {
  const actions = new Map(), events = new Map(), failures = new Map(), accepted = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, '$type')) {
      const name = actionName(value);
      actions.set(name, (actions.get(name) ?? 0) + 1);
    }
    for (const child of Object.values(value)) walk(child);
  }
  for (const [key, template] of Object.entries(templates)) {
    walk(template.eventToActions);
    for (const event of Object.keys(template.eventToActions ?? {})) events.set(event, (events.get(event) ?? 0) + 1);
    try {
      const program = compileBuffTemplate(template);
      accepted.push({ key, requiredBlackboard: program.requiredBlackboard, events: Object.keys(template.eventToActions),
        actionCount: Object.values(template.eventToActions).reduce((n, nodes) => n + nodes.length, 0) });
    } catch (error) {
      // One first rejection per template; nested action counts above remain exhaustive.
      failures.set(error.message, (failures.get(error.message) ?? 0) + 1);
    }
  }
  const rows = map => [...map].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
  return {
    schemaVersion: 1, source,
    scope: 'Isolated action support only. No automatic skill/operator enablement; rejected templates never partially execute.',
    summary: { templateRecords: Object.keys(templates).length, actionTypes: actions.size,
      acceptedTemplates: accepted.length, rejectedTemplates: Object.keys(templates).length - accepted.length,
      acceptedTemplatesWithActions: accepted.filter(t => t.actionCount > 0).length,
      boundPlayableOperators: bindings.length, boundPlayableTemplates: new Set(bindings.map(b => b.templateKey)).size },
    bindings, acceptedTemplates: accepted.sort((a, b) => a.key.localeCompare(b.key)),
    actionTypes: rows(actions), events: rows(events), firstRejections: rows(failures),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = JSON.parse(await readFile(new URL('../../data/arkpedia-mvp.json', import.meta.url), 'utf8'));
  const source = data.behaviors.source;
  const cached = new URL('../../.cache/arkpedia/buff_template_data.json', import.meta.url);
  if (process.argv.includes('--fetch')) {
    const response = await fetch(`https://raw.githubusercontent.com/${source.repository}/${source.commit}/${source.path}`,
      { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error(`Behaviour source unavailable (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw Error('Behaviour source checksum mismatch');
    await mkdir(new URL('../../.cache/arkpedia/', import.meta.url), { recursive: true });
    await writeFile(cached, bytes);
  }
  const bytes = await readFile(cached);
  if (source.commit !== data.sources[source.repository] || createHash('sha256').update(bytes).digest('hex') !== source.sha256)
    throw Error('Behaviour source differs from the playable snapshot');
  const bindings = Object.entries(REGULAR_OPERATORS).filter(([, s]) => s.templateKey).map(([id, s]) => ({
    operator: id, skillId: s.skillId, prefabId: s.prefabId, templateKey: s.templateKey,
  }));
  const report = auditBehaviorTemplates(JSON.parse(bytes), { source, bindings });
  await writeFile(new URL('../../data/arkpedia-behavior-audit.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary));
}
