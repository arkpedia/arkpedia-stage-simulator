"""Checksum-verified native prefab evidence, shared by focused content imports."""
import hashlib
import json
import aklz4  # noqa: F401
import UnityPy


def exact(value, key=''):
    if isinstance(value, dict):
        return {k: exact(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [exact(v, key) for v in value]
    return str(value) if key == 'm_PathID' else value


def read_prefabs(cache, manifest, bundle, group, keys, *, uncensored=True,
                 component_types=('MonoBehaviour',)):
    row = next(r for r in manifest['abInfos'] if r['name'] == bundle)
    raw = (cache / 'bundles' / bundle).read_bytes()
    assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5'], bundle
    env = UnityPy.load(raw)
    by_id = {o.path_id: o for o in env.objects}
    prefabs = {}
    for key in keys:
        components = []

        def walk(go):
            data = go.read_typetree()
            for component in data['m_Component']:
                obj = by_id[component['component']['m_PathID']]
                value = obj.read_typetree()
                if obj.type.name in component_types:
                    components.append({'object': data['m_Name'], 'pathId': str(obj.path_id), 'data': exact(value)})
                if obj.type.name == 'Transform':
                    for child in value['m_Children']:
                        transform = by_id[child['m_PathID']].read_typetree()
                        walk(by_id[transform['m_GameObject']['m_PathID']])

        asset = f'dyn/battle/prefabs/{"[uc]" if uncensored else ""}{group}/{key}.prefab'
        walk(env.container[asset])
        prefabs[key] = {'bundle': bundle, 'asset': asset, 'components': components}
    return prefabs, {'path': bundle, 'bytes': len(raw), 'md5': row['md5'], 'sha256': hashlib.sha256(raw).hexdigest()}
