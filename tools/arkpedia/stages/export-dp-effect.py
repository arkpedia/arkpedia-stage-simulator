#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export the reviewed charge-cost activation burst, not the DP-counter flight.

Only this prefab's five billboard emitters are accepted. New enabled modules,
material variants and weighted curves fail export rather than disappear silently.
Game artwork remains copyright Hypergryph. No third-party particle code is used.
"""
import argparse, hashlib, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'local-extract'))
import aklz4
import UnityPy

KEY = 'common_charge_cost_start_01'
BUNDLES = ['battle/prefabs/effects/common.ab', 'refs/fx/material.ab',
           'refs/fx/texture/star.ab', '[uc]shaders.ab']
NAMES = {'xingdian', 'andi_11', 'andi', 'baoshan', 'baodian'}
MODULES = {'InitialModule', 'ShapeModule', 'EmissionModule', 'SizeModule',
           'ColorModule', 'RotationModule', 'ClampVelocityModule', 'SubModule'}

def curve(v):
    mode = v['minMaxState']
    if mode not in (0, 1, 3): raise ValueError('Unsupported particle curve mode')
    out = {'mode': mode, 'value': v['scalar'], 'min': v['minScalar']}
    if mode == 1:
        keys = v['maxCurve']['m_Curve']
        if not keys or any(k['weightedMode'] != 0 for k in keys):
            raise ValueError('Weighted or empty curve')
        out['keys'] = [[k['time'], k['value'], k['inSlope'], k['outSlope']] for k in keys]
    return out

def color(v):
    mode = v['minMaxState']
    if mode == 0:
        return {'mode': 0, 'value': [v['maxColor'][c] for c in 'rgba']}
    if mode != 1: raise ValueError('Unsupported particle gradient mode')
    g = v['maxGradient']
    if g['m_Mode'] != 0: raise ValueError('Non-interpolated gradient')
    # RGB and alpha have independent counts and times; unused Unity key slots
    # frequently contain unrelated values and must never enter the gradient.
    return {'mode': 1,
            'rgb': [[g[f'ctime{i}']/65535, *[g[f'key{i}'][c] for c in 'rgb']]
                    for i in range(g['m_NumColorKeys'])],
            'alpha': [[g[f'atime{i}']/65535, g[f'key{i}']['a']]
                      for i in range(g['m_NumAlphaKeys'])]}

def vec(v): return [v[c] if isinstance(v, dict) else getattr(v,c) for c in 'xyz']
def digest(p):
    b = p.read_bytes()
    return {'path': p.name, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}

def export(args):
    manifest = json.loads(args.manifest.read_text())
    if manifest['versionId'] != args.version: raise ValueError('Wrong resource version')
    env = UnityPy.Environment(); sources = []
    for name in BUNDLES:
        entry = next(e for e in manifest['abInfos'] if e['name'] == name)
        raw = (args.bundles/name).read_bytes()
        if len(raw) != entry['abSize'] or hashlib.md5(raw).hexdigest() != entry['md5']:
            raise ValueError(f'Bundle checksum mismatch: {name}')
        env.load_file(raw, name=name)
        sources.append({'bundle': name, 'md5': entry['md5'], 'bytes': len(raw)})
    roots = [o.read() for o in env.objects if o.type.name == 'GameObject' and o.read().m_Name == KEY]
    if len(roots) != 1: raise ValueError('Missing or duplicate DP burst prefab')
    args.out.mkdir(parents=True, exist_ok=True)
    emitters = []; textures = {}
    def walk(go, parent=None):
        components = {p.component.type.name: p.component for p in go.m_Component}
        tr = components['Transform'].read()
        transform = {'position': vec(tr.m_LocalPosition),
                     'rotation': [getattr(tr.m_LocalRotation, c) for c in 'xyzw'],
                     'scale': vec(tr.m_LocalScale)}
        # All ancestors of the reviewed emitters are identity transforms.
        if go.m_Name not in NAMES and (transform['position'] != [0,0,0] or
                transform['rotation'] != [0,0,0,1] or transform['scale'] != [1,1,1]):
            raise ValueError('New parent transform needs explicit composition')
        if 'ParticleSystem' in components:
            pr = components['ParticleSystemRenderer'].read_typetree()
            if pr['m_Enabled']:
                ps = components['ParticleSystem'].read_typetree()
                enabled = {k for k,v in ps.items() if k.endswith('Module') and v.get('enabled')}
                if go.m_Name not in NAMES or enabled - MODULES or pr['m_RenderMode'] != 0 or pr['m_RenderAlignment'] not in (0,2):
                    raise ValueError(f'Unsupported emitter: {go.m_Name}: {enabled}')
                delay = curve(ps['startDelay'])
                if ps['looping'] or ps['moveWithTransform'] != 0 or ps['useUnscaledTime'] or ps['prewarm'] or ps['simulationSpeed'] != 1 or delay['mode'] != 0 or delay['value'] != 0:
                    raise ValueError('Unsupported emitter time/space')
                init = ps['InitialModule']
                if init['size3D'] or init['rotation3D'] or curve(init['gravityModifier'])['value'] != 0:
                    raise ValueError('Unsupported initial particle dimensions/gravity')
                renderer = components['ParticleSystemRenderer'].read()
                # Unity serializes a second, unused trail material even when
                # TrailsModule is disabled. Both slots are identical here.
                if not renderer.m_Materials or len({(p.file_id,p.path_id) for p in renderer.m_Materials}) != 1:
                    raise ValueError('Multiple particle materials')
                mat = renderer.m_Materials[0].read()
                shader = mat.m_Shader.read_typetree()['m_ParsedForm']
                if shader['m_Name'] not in ('Torappu/Particles/Additive','Torappu/Particles/AlphaBlend'):
                    raise ValueError('Unknown particle shader')
                tex = dict(mat.m_SavedProperties.m_TexEnvs)['_MainTex']
                if vec2(tex.m_Scale) != [1,1] or vec2(tex.m_Offset) != [0,0]: raise ValueError('New texture transform')
                image = tex.m_Texture.read()
                if image.m_Name not in ('star_02','star_15'): raise ValueError('Unexpected burst texture')
                if image.m_Name not in textures:
                    p = args.out/(image.m_Name+'.webp'); image.image.save(p, lossless=True, exact=True)
                    textures[image.m_Name] = digest(p)
                tint = dict(mat.m_SavedProperties.m_Colors)['_TintColor']
                e = {'id': go.m_Name, 'sourcePathId': str(components['ParticleSystem'].path_id),
                     'transform': transform, 'duration': ps['lengthInSec'], 'alignment': pr['m_RenderAlignment'],
                     'material': {'texture': image.m_Name, 'blend': 'additive' if shader['m_Name'].endswith('/Additive') else 'alpha',
                                  'tint': [getattr(tint,c) for c in 'rgba']},
                     'lifetime': curve(init['startLifetime']), 'speed': curve(init['startSpeed']),
                     'size': curve(init['startSize']), 'rotation': curve(init['startRotation']),
                     'startColor': color(init['startColor'])}
                shape = ps['ShapeModule']
                if shape['enabled']:
                    if shape['type'] not in (0,4) or shape['arc']['mode'] != 0 or shape['randomDirectionAmount'] or shape['sphericalDirectionAmount'] or shape['randomPositionAmount']:
                        raise ValueError('Unsupported particle shape')
                    if vec(shape['m_Position']) != [0,0,0] or vec(shape['m_Rotation']) != [0,0,0] or vec(shape['m_Scale']) != [1,1,1]:
                        raise ValueError('Shape transform needs explicit composition')
                    e['shape'] = {'type': shape['type'], 'radius': shape['radius']['value'],
                                  'thickness': shape['radiusThickness'], 'angle': shape['angle'], 'arc': shape['arc']['value']}
                emission = ps['EmissionModule']
                if curve(emission['rateOverDistance'])['value'] != 0: raise ValueError('Distance emission unsupported')
                e['rate'] = curve(emission['rateOverTime'])
                e['bursts'] = []
                for b in emission['m_Bursts'][:emission['m_BurstCount']]:
                    if b['cycleCount'] != 1 or b['probability'] != 1: raise ValueError('Unsupported burst cycles')
                    e['bursts'].append({'time': b['time'], 'count': curve(b['countCurve'])})
                if ps['SizeModule']['enabled']:
                    if ps['SizeModule']['separateAxes']: raise ValueError('3D size curve unsupported')
                    e['sizeOverLife'] = curve(ps['SizeModule']['curve'])
                if ps['ColorModule']['enabled']: e['colorOverLife'] = color(ps['ColorModule']['gradient'])
                if ps['RotationModule']['enabled']:
                    if ps['RotationModule']['separateAxes']: raise ValueError('3D angular velocity unsupported')
                    e['angularVelocity'] = curve(ps['RotationModule']['curve'])
                if ps['ClampVelocityModule']['enabled']:
                    c = ps['ClampVelocityModule']
                    if c['separateAxis'] or curve(c['drag'])['value'] != 0: raise ValueError('Unsupported velocity clamp')
                    e['velocityLimit'] = {'speed': curve(c['magnitude']), 'dampen': c['dampen']}
                if ps['SubModule']['enabled']:
                    sub = ps['SubModule']['subEmitters']
                    if len(sub) != 1 or sub[0]['type'] != 0 or sub[0]['properties'] != 0 or sub[0]['emitProbability'] != 1:
                        raise ValueError('Unsupported sub-emitter event')
                    e['birthEmitterPathId'] = str(sub[0]['emitter']['m_PathID'])
                emitters.append(e)
        for child in tr.m_Children: walk(child.read().m_GameObject.read(), go.m_Name)
    walk(roots[0])
    if {e['id'] for e in emitters} != NAMES: raise ValueError('Missing DP burst emitters')
    by_path = {e['sourcePathId']: e['id'] for e in emitters}
    for e in emitters:
        if 'birthEmitterPathId' in e:
            e['birthEmitter'] = by_path[e.pop('birthEmitterPathId')]
    result = {'schemaVersion':1, 'key':KEY, 'coordinates':'unity-x-y-z',
              'source': {'provider':'official-global-android', 'version':args.version, 'bundles':sources},
              'scope': {'implemented':'activation-burst',
                        'deferred':['common_charge_cost_01 DP-counter flight, noise and trail scripts'],
                        'approximations':['60 Hz velocity-limit damping', 'operator centre anchor at 0.6 tile height']},
              'textures': textures, 'emitters': emitters}
    (args.out/'effect.json').write_text(json.dumps(result, indent=2)+'\n')
    print(f'Exported {len(emitters)} original burst emitters and {len(textures)} textures')

def vec2(v): return [getattr(v,c) for c in 'xy']

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--bundles',type=Path,required=True); p.add_argument('--manifest',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True); p.add_argument('--version',required=True)
    export(p.parse_args())
