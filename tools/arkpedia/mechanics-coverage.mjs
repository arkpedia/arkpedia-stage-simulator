#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Planning evidence only. Registration/build counts are not fidelity approval.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertRegularOperator } from '../../shared/arkpedia/operators.js';
import { SUPPORTED_STAGE_DEVICE_NAMES } from '../../shared/arkpedia/stage-devices.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => JSON.parse(readFileSync(file));
const local = name => read(path.join(root, 'data', name));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function buildMechanicsCoverage({ sourceRoot = path.resolve(root, '../arkpedia-data') } = {}) {
  const pin = local('arkpedia-canonical-stage-16-8.lock.json');
  const manifestRaw = readFileSync(path.join(sourceRoot, pin.files.manifest.path));
  if (manifestRaw.length !== pin.files.manifest.bytes || sha(manifestRaw) !== pin.files.manifest.sha256)
    throw Error('Mechanics audit requires the pinned canonical release manifest');
  const manifest = JSON.parse(manifestRaw);
  const source = relative => {
    const file = path.join(sourceRoot, 'source', relative);
    if (!existsSync(file)) return null;
    const raw = readFileSync(file);
    if (sha(raw) !== manifest.sourceHashes[relative]) throw Error('Canonical audit input changed: ' + relative);
    return JSON.parse(raw);
  };
  const candidate = local('candidates/arkpedia-ch16-enemy-support.json');
  const ordinary = local('arkpedia-enemy-support.json');
  const roster = local('arkpedia-roster-target.json');
  const mvp = local('arkpedia-mvp.json');
  const catalogue = local('arkpedia-stages.json');
  const catalogueById = new Map(catalogue.stages.map(s => [s.id, s]));
  const devices = source('data/stage-devices.json');
  const stages = [], blockers = new Map(), byType = {}, byBlocker = {};
  const stagesDir = path.join(sourceRoot, 'source/data/stages');
  const expectedStagePaths = Object.keys(manifest.sourceHashes).filter(p => p.startsWith('data/stages/') && p.endsWith('.json'));
  const actual = readdirSync(stagesDir).filter(f => f.endsWith('.json')).map(f => 'data/stages/' + f).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expectedStagePaths.sort()))
    throw Error('Canonical audit stage membership is incomplete or changed');
  for (const file of actual) {
    const stage = source(file);
    if (!stage.battle) continue;
    byType[stage.stage_type] = (byType[stage.stage_type] ?? 0) + 1;
    const entry = catalogueById.get(stage.slug), built = !!entry;
    const base = stage.slug.replace(/_(challenge_mode|six_star|adverse_environment)$/, '');
    const geometry = source('data/stage-geometry/' + stage.slug + '.json')
      ?? (base !== stage.slug ? source('data/stage-geometry/' + base + '.json') : null);
    const observed = [], unsupportedEnemies = [];
    if (!geometry) observed.push('missing-geometry');
    else {
      if (geometry.rows > 19 || geometry.cols > 21) observed.push('oversized-grid');
      if ((geometry.suppliedUnits?.deployable_tokens ?? []).some(t => t.count !== 0)) observed.push('stage-token-contract');
      if (geometry.hasConditionalSpawns) observed.push('conditional-stage-contract');
      const stageDevices = devices[stage.geometryKey ?? stage.slug] ?? devices[base] ?? [];
      if (stageDevices.some(d => d.kind === 'device' && !String(d.key).startsWith('char_') && !SUPPORTED_STAGE_DEVICE_NAMES.includes(d.name)))
        observed.push('stage-device-contract');
      const conditional = source('data/stage-conditional/' + stage.slug + '.json') ?? [];
      const ids = new Set([
        ...(geometry.waves ?? []).flatMap(w => (w.spawns ?? []).map(s => s.enemy_id)),
        ...(geometry.enemyConfigurations ?? []).map(c => c.enemy_id),
        ...conditional.map(c => c.enemy_id),
      ].filter(Boolean));
      for (const id of ids) if (!candidate.enemies[id]?.policy) {
        unsupportedEnemies.push(id);
        if (!built) blockers.set(id, (blockers.get(id) ?? 0) + 1);
      }
      if (unsupportedEnemies.length) observed.push('enemy-mechanics');
    }
    // Existing reviewed contracts can handle observed generic gates. Do not
    // relabel a built stage unsupported, or admit an unbuilt one from this report.
    if (!built) for (const reason of observed) byBlocker[reason] = (byBlocker[reason] ?? 0) + 1;
    stages.push({ id:stage.slug, code:stage.code, type:stage.stage_type,
      catalogue:built ? entry.testOnly ? 'test-only' : 'public' : 'not-built',
      observedGenericGates:observed, unsupportedCanonicalEnemies:unsupportedEnemies.sort() });
  }
  const forms = roster.operators.map(target => {
    const op = mvp.operators[target.id];
    let registration = 'missing';
    if (op) { assertRegularOperator(op); registration = 'registered'; }
    return { id:target.id, registration, skills:op?.skills.map(s => s.id) ?? [],
      mechanicsAudit:'requires-source-and-behavior-audit' };
  });
  const enemyRows = Object.entries(candidate.enemies).map(([id,e]) => ({ id, policy:e.policy,
    unresolved:e.reasons, native:e.native })).sort((a,b) => a.id.localeCompare(b.id));
  return { schemaVersion:1,
    scope:'Mechanics-first planning inventory across every canonical combat-stage record, enemy and target operator form. Registration, retained source and file-backed builds do not certify complete mechanics or native frame parity. No runtime admission.',
    sources:{ stages:{repository:pin.repository,commit:pin.commit,manifestSha256:pin.files.manifest.sha256},
      canonicalEnemies:candidate.source.records, ordinaryEnemies:ordinary.source.records, operatorTarget:roster.source },
    summary:{ combatStageRecords:stages.length, catalogueBattleRecords:stages.filter(s=>s.catalogue!=='not-built').length,
      unbuiltCombatStageRecords:stages.filter(s=>s.catalogue==='not-built').length,
      canonicalEnemies:enemyRows.length, sourceBoundSupportedEnemies:enemyRows.filter(e=>e.policy).length,
      unsupportedCanonicalEnemies:enemyRows.filter(e=>!e.policy).length,
      targetOperatorForms:forms.length, registeredOperatorForms:forms.filter(o=>o.registration==='registered').length,
      registeredSkills:forms.reduce((n,o)=>n+o.skills.length,0), operatorMechanicsAuditComplete:false },
    stagesByType:byType, unbuiltStageGenericGates:byBlocker,
    enemyBlockers:[...blockers].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([id,stages])=>({id,stages,reasons:candidate.enemies[id]?.reasons??['missing-canonical-record']})),
    operators:forms, enemies:enemyRows, stages };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report=buildMechanicsCoverage();
  writeFileSync(path.join(root,'data/candidates/arkpedia-mechanics-coverage.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({summary:report.summary,stageTypes:report.stagesByType,
    genericGates:report.unbuiltStageGenericGates,topEnemyBlockers:report.enemyBlockers.slice(0,12)},null,2));
}
