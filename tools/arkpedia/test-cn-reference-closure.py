#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Exercise both original-source dependency walkers without Unity/network setup."""
import ast
import copy
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


def dependency_walk(kind, source, assets):
    """Run the actual walkers, replacing only their original-bundle readers."""
    path = ROOT / 'tools/arkpedia' / f'{kind}-cn-operator.py'
    tree = ast.parse(path.read_text())
    parameters = next(n for n in tree.body if isinstance(n, ast.Assign)
                      and any(isinstance(t, ast.Name) and t.id == 'parameters' for t in n.targets))
    resolved = []

    def graph(bundle, container):
        key = container.rsplit('/', 1)[-1].removesuffix('.prefab')
        resolved.append(key)
        return copy.deepcopy(assets[key])

    env = dict(json=json, ct={}, st={}, skills={}, bt={}, native={}, db={}, needed=set(),
               db_keys=set(), projectile_path='original-projectiles', projectiles={},
               projectile_graphs={}, tokens={}, token_graphs={}, token_skill_bindings={},
               token_prefab_overrides={}, token_mode_skills={}, strings=set(),
               graph=graph, original_graph=graph, queue=[copy.deepcopy(source)],
               projectile_bundle={'roots': {f'dyn/battle/prefabs/[uc]projectiles/{k}.prefab': 1
                                            for k in assets}})
    nodes = [parameters]
    if kind == 'extract':
        nodes.append(next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'scan'))
    else:
        nodes.extend(n for n in tree.body if
                     (isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'stack'
                                                      for t in n.targets)) or
                     (isinstance(n, ast.While) and isinstance(n.test, ast.Name) and n.test.id == 'stack'))
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), 'exec'), env)
    if kind == 'extract':
        env['scan'](copy.deepcopy(source))
    return set(resolved)


# Exact formula shape recovered from the pinned Angelina Alter native inputs:
# chant_duration is assigned into projectile_life_time, not a prefab reference.
FORMULA = {'_formulaType': 0, '_acceptEmptyBB': 0, '_validateSkillIndices': 0,
           '_skillIndices': [], '_source': 1, '_sourceTalentKey': '',
           '_sourceKey': 'chant_duration', '_source2': 0, '_sourceTalentKey2': '',
           '_sourceKey2': '', '_target': 1, '_targetTalentKey': '',
           '_targetKey': 'projectile_life_time', '_overrideRangeId': 0, '_type': 0}


class ClosureTests(unittest.TestCase):
    def both(self, source, assets, expected):
        for kind in ('extract', 'verify'):
            with self.subTest(walker=kind):
                self.assertEqual(dependency_walk(kind, source, assets), set(expected))

    def missing(self, source):
        for kind in ('extract', 'verify'):
            with self.subTest(walker=kind):
                with self.assertRaises((AssertionError, KeyError)):
                    dependency_walk(kind, source, {})

    def test_formula_parameter_never_replaces_actual_transitive_assets(self):
        source = {'formula': FORMULA, '_projectileKey': 'projectile_owner'}
        assets = {'projectile_owner': {'_projectileKey': 'projectile_child'}, 'projectile_child': {}}
        self.both(source, assets, assets)

    def test_all_formula_operands_can_name_projectile_parameters(self):
        formula = {**FORMULA, '_sourceKey': 'projectile_index',
                   '_sourceKey2': 'projectile_atk_scale', '_targetKey': 'projectile_min_atk_scale'}
        self.both([formula, {'key': 'projectile_range'}], {}, [])

    def test_arbitrary_target_key_is_still_an_asset_reference(self):
        self.missing({'_targetKey': 'projectile_missing'})
        incomplete = {k: v for k, v in FORMULA.items() if k != '_formulaType'}
        self.missing(incomplete)

    def test_genuine_projectile_reference_inside_formula_still_fails(self):
        self.missing({**FORMULA, '_projectileKey': 'projectile_missing'})

    def test_nested_serialized_formula_retains_real_asset_requirements(self):
        source = {'payload': json.dumps([FORMULA, {'_projectileKey': 'projectile_real'}])}
        self.both(source, {'projectile_real': {}}, ['projectile_real'])
        self.missing(source)

    def test_missing_transitive_projectile_is_not_ignored(self):
        for kind in ('extract', 'verify'):
            with self.subTest(walker=kind):
                with self.assertRaises((AssertionError, KeyError)):
                    dependency_walk(kind, {'_projectileKey': 'projectile_owner'},
                                    {'projectile_owner': {'_projectileKey': 'projectile_missing'}})


if __name__ == '__main__':
    unittest.main()
