#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Inspect reviewed skill prefabs and original effects; not a particle exporter.

Verify official bundles, compare two source templates to the pinned JSON dump,
and record exact prefab bindings. No guesses based on character/skill names.
"""
import argparse, collections, hashlib, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'local-extract'))
import aklz4
import UnityPy

BUNDLES = ['config/buff_template_holder.ab', 'battle/prefabs/[uc]skills.ab',
           'battle/prefabs/[uc]projectiles.ab', 'battle/prefabs/effects/buff.ab',
           'battle/prefabs/effects/common.ab']
PREFABS = ['skcom_charge_cost', 'skchr_wyvern_1', 'skcom_heal_self']
TEMPLATES = ['charge_cost', 'instant_heal[hp_ratio]']

def normalize_types(value):
    if isinstance(value, list): return [normalize_types(x) for x in value]
    if not isinstance(value, dict): return value
    return {k: (v.replace(', Assembly-CSharp', '') if k == '$type' else normalize_types(v))
            for k, v in value.items()}

def inspect(args):
    manifest = json.loads(args.manifest.read_text())['abInfos']
    source_templates = json.loads(args.templates.read_text())
    sources, envs = [], {}
    for name in BUNDLES:
        entry = next(x for x in manifest if x['name'] == name)
        raw = (args.bundles / name).read_bytes()
        if len(raw) != entry['abSize'] or hashlib.md5(raw).hexdigest() != entry['md5']:
            raise ValueError('Bundle checksum mismatch: ' + name)
        envs[name] = UnityPy.load(raw)
        sources.append({'bundle': name, 'md5': entry['md5'], 'bytes': len(raw)})
    holders = [o.read_typetree() for o in envs[BUNDLES[0]].objects if o.type.name == 'MonoBehaviour']
    if len(holders) != 1: raise ValueError('Unexpected template holder')
    for key in TEMPLATES:
        rows = [t for t in holders[0]['_templates'] if t['templateKey'] == key]
        if len(rows) != 1: raise ValueError('Missing/duplicate template: ' + key)
        row = rows[0]; events = row['eventToActions']['_items']
        # Only the start event (0) and default priority (0) are reviewed here.
        if row['onEventPriority'] != 0 or row['effectKey'] or len(events) != 1 or events[0]['key'] != 0:
            raise ValueError('Unsupported template metadata: ' + key)
        actions = json.loads(events[0]['value']['SerializedState'])
        if events[0]['value']['SerializedObjectReferences']:
            raise ValueError('External action references: ' + key)
        expected = source_templates[key]
        if normalize_types(actions) != normalize_types(expected['eventToActions']['ON_BUFF_START']):
            raise ValueError('Game bundle and pinned template JSON disagree: ' + key)
    prefabs = {}
    for o in envs[BUNDLES[1]].objects:
        if o.type.name != 'GameObject': continue
        go = o.read()
        if go.m_Name not in PREFABS: continue
        if go.m_Name in prefabs: raise ValueError('Duplicate skill prefab')
        components = [p.component.read_typetree() for p in go.m_Component if p.component.type.name == 'MonoBehaviour']
        buffs = [b for c in components for b in c.get('_buffs', [])]
        heals = [c for c in components if '_isHpRatio' in c]
        effect_keys = set()
        for c in components:
            for field in ['_hitEffects', '_castEffects', '_attachEffects', '_inputTargetEffects', '_castTargetEffects']:
                for e in c.get(field, []): effect_keys.update(k for k in e['_effects'] if k)
        effect_keys.update(b['overrideEffectKey'] for b in buffs if b['overrideEffectKey'])
        prefabs[go.m_Name] = {
            'buffTemplates': [b['templateKey'] for b in buffs],
            'nativeHeal': [{k: c[k] for k in ['_isHpRatio', '_isCont', '_ignoreHealFree', '_applyEPHeal']} for c in heals],
            'effectKeys': sorted(effect_keys),
        }
    if set(prefabs) != set(PREFABS): raise ValueError('Missing skill prefab')
    inventory = []
    references = {k for p in prefabs.values() for k in p['effectKeys']}
    for name in BUNDLES[2:]:
        env = envs[name]
        names = {o.read().m_Name for o in env.objects if o.type.name == 'GameObject'}
        inventory.append({'bundle': name, 'objectCounts': dict(sorted(collections.Counter(o.type.name for o in env.objects).items())),
                          'referencedEffectRoots': sorted(names & references), 'browserRendererImplemented': False})
    result = {'schemaVersion': 1, 'source': {'provider': 'official-global-android', 'version': args.version, 'bundles': sources},
              'templateTableSha256': hashlib.sha256(args.templates.read_bytes()).hexdigest(),
              'prefabs': dict(sorted(prefabs.items())), 'effectsInventory': inventory}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2) + '\n')
    print('Verified three skill prefabs and two template records; inventoried original effect bundles')

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--bundles', type=Path, required=True)
    p.add_argument('--manifest', type=Path, required=True)
    p.add_argument('--templates', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--version', required=True)
    inspect(p.parse_args())
