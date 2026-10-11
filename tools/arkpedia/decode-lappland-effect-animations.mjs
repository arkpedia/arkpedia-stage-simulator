// SPDX-License-Identifier: GPL-3.0-or-later
// Prepare original effect channels in the source cache. No public asset or
// operator is enabled by this export.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeEffectClip, sampleEffectClip} from '../../shared/arkpedia/native-effect-animation.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(ROOT, '.cache/arkpedia/lappland-alter-source/effects');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => JSON.stringify(value) + '\n';
const assert = (condition, message) => {if (!condition) throw new Error(message);};
const crc32 = text => {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const raw = await fs.readFile(path.join(directory, 'native-effects.bin'));
const native = JSON.parse(gunzipSync(raw));
const source = JSON.parse(await fs.readFile(path.join(ROOT, 'data/arkpedia-lappland-effects.json'), 'utf8'));
assert(sha(raw) === source.pack.sha256, 'Source pack differs from audited manifest');
const records = native.records;
const refs = (key, field) => (records[key].references ?? []).filter(r => r.field === field).map(r => r.target);
const one = (key, field) => {
  const found = refs(key, field);
  assert(found.length === 1 && found[0], `Missing/ambiguous ${field} on ${key}`);
  return found[0];
};
const components = key => refs(key, 'component');
const transform = go => {
  const found = components(go).filter(k => records[k]?.type === 'Transform');
  assert(found.length === 1, `Missing/ambiguous transform on ${go}`);
  return found[0];
};
const types = {1:'GameObject',4:'Transform',23:'MeshRenderer',96:'TrailRenderer',199:'ParticleSystemRenderer'};
const transforms = {1:'m_LocalPosition',2:'m_LocalRotation',3:'m_LocalScale',4:'localEulerAnglesRaw'};
function property(component, binding) {
  if (binding.typeID === 4) return transforms[binding.attribute];
  if (binding.typeID === 1 && binding.customType === 0 && binding.attribute === crc32('m_IsActive')) return 'm_IsActive';
  assert(binding.customType === 22, 'Unsupported native property binding');
  const names = new Set();
  for (const material of refs(component, 'm_Materials')) {
    assert(material && records[material]?.type === 'Material', 'Unresolved animated material');
    const saved = records[material].data.m_SavedProperties;
    for (const table of ['m_Floats', 'm_Colors']) for (const [name] of saved[table]) names.add(name);
    // Native texture scale/offset vectors are exposed as <texture>_ST, while
    // the material serializes them inside that texture's m_TexEnvs entry.
    for (const [name] of saved.m_TexEnvs) names.add(name + '_ST');
  }
  const matches = [...names].filter(n => (crc32(n) & 0x0fffffff) === (binding.attribute & 0x0fffffff));
  assert(matches.length === 1, `Unresolved/ambiguous animated property ${binding.attribute} on ${component}`);
  const suffix = binding.attribute & 0x80000000 ? '' : '.' +
    (binding.attribute & 0x40000000 ? 'rgba' : 'xyzw')[(binding.attribute >>> 28) & 3];
  return 'material.' + matches[0] + suffix;
}

const clips = {}, fixtures = {}, instances = [];
for (const [key, record] of Object.entries(records)) {
  if (record.type !== 'AnimationClip') continue;
  const d = record.data, m = d.m_MuscleClip;
  const fixture = Object.fromEntries(['m_Name', 'm_RotationCurves', 'm_CompressedRotationCurves',
    'm_EulerCurves', 'm_PositionCurves', 'm_ScaleCurves', 'm_FloatCurves', 'm_PPtrCurves',
    'm_ClipBindingConstant'].map(k => [k,d[k]]));
  fixture.m_MuscleClip = {m_StartTime:m.m_StartTime, m_StopTime:m.m_StopTime,
    m_LoopTime:m.m_LoopTime, m_Clip:m.m_Clip};
  fixtures[key] = {sourceSha256:record.serializedSha256, data:fixture};
  clips[key] = {sourceSha256:record.serializedSha256,
    ...decodeEffectClip(record.data), events:record.data.m_Events};
}
assert(Object.keys(clips).length === 10, 'Incomplete native clip inventory');
for (const [key, record] of Object.entries(records)) {
  if (record.type !== 'Animator') continue;
  const controllers = refs(key, 'm_Controller');
  // Preserve animators without a controller in the original source pack.
  if (!controllers.length) continue;
  const controller = one(key, 'm_Controller'), go = one(key, 'm_GameObject'), paths = new Map();
  function walk(tr, relative, ancestors) {
    assert(!ancestors.has(tr), 'Cyclic animation hierarchy');
    const hash = crc32(relative), childGo = one(tr, 'm_GameObject');
    assert(!paths.has(hash), 'Ambiguous animation path hash');
    paths.set(hash, {path:relative, gameObject:childGo});
    for (const child of refs(tr, 'm_Children')) {
      const childName = records[one(child, 'm_GameObject')].data.m_Name;
      walk(child, relative ? relative + '/' + childName : childName, new Set([...ancestors, tr]));
    }
  }
  walk(transform(go), '', new Set());
  for (const clipKey of refs(controller, 'm_AnimationClips')) {
    const clip = clips[clipKey];
    assert(clip, `Missing native clip ${clipKey}`);
    const bindings = clip.bindings.map(binding => {
      const node = paths.get(binding.path);
      assert(node, `Unresolved animation path ${binding.path} in ${key}`);
      const targets = binding.typeID === 1 ? [node.gameObject] :
        components(node.gameObject).filter(k => records[k]?.type === types[binding.typeID]);
      assert(targets.length === 1, 'Missing/ambiguous animated component');
      return {...node, component:targets[0], property:property(targets[0], binding)};
    });
    instances.push({animator:key, controller, clip:clipKey, bindings});
  }
}
assert(new Set(instances.map(i => i.clip)).size === 10, 'Unbound native animation clip');
const decoded = {schemaVersion:1, operator:native.operator, version:native.version,
  sourcePackSha256:sha(raw), coordinates:'original-unity', clips, instances};
const decodedBytes = encode(decoded);
await fs.writeFile(path.join(directory, 'native-animations.json'), decodedBytes);
const fixturePath = 'test/fixtures/arkpedia-lappland-effect-clips.json', fixtureBytes = encode(fixtures);
await fs.writeFile(path.join(ROOT, fixturePath), fixtureBytes);
// Independent verifier probes every sparse segment, all keys, and loop seams.
const samples = Object.fromEntries(Object.entries(clips).map(([key, clip]) => {
  const times = new Set([clip.start - 1, clip.start, clip.stop, clip.stop + .125]);
  for (const channel of clip.channels) for (let i = 0; i < (channel.keys?.length ?? 0); i++) {
    const t = channel.keys[i].time;
    times.add(t);
    if (i + 1 < channel.keys.length) for (const fraction of [.25,.5,.75]) {
      times.add(t + (channel.keys[i+1].time - t) * fraction);
    }
  }
  return [key, [...times].sort((a,b) => a-b).flatMap(time => [false,true].map(loop =>
    ({time, loop, values:sampleEffectClip(clip, time, {loop})})))];
}));
await fs.writeFile(path.join(directory, 'native-animation-samples.json'), encode(samples));
const manifest = {schemaVersion:1, operator:native.operator, version:native.version,
  scope:{sourceChannelsOnly:true, rendererVerified:false, compiledFrameParity:false, enabledOperators:[],
    pending:['Animator state/transition dispatch and renderer property application',
      'Native shader, particle and trail execution; unresolved resources; browser review']},
  sourcePackSha256:sha(raw), artifact:{path:'native-animations.json', bytes:Buffer.byteLength(decodedBytes), sha256:sha(decodedBytes)},
  fixture:{path:fixturePath, bytes:Buffer.byteLength(fixtureBytes), sha256:sha(fixtureBytes)},
  counts:{clips:Object.keys(clips).length, instances:instances.length,
    bindings:Object.values(clips).reduce((n,c)=>n+c.bindings.length,0),
    channels:Object.values(clips).reduce((n,c)=>n+c.channels.length,0),
    keys:Object.values(clips).reduce((n,c)=>n+c.channels.reduce((m,t)=>m+(t.keys?.length??0),0),0)},
  clips:Object.fromEntries(Object.entries(clips).map(([key,c]) => [key,
    {name:c.name, sourceSha256:c.sourceSha256, start:c.start, stop:c.stop, loop:c.loop,
      bindings:c.bindings.length, channels:c.channels.length, keys:c.channels.reduce((n,t)=>n+(t.keys?.length??0),0)}])),
  properties:[...new Set(instances.flatMap(i=>i.bindings.map(b=>b.property)))].sort(),
  formatReferences:['https://github.com/Perfare/AssetStudio/blob/master/AssetStudio/Classes/AnimationClip.cs',
    'https://github.com/mafaca/UtinyRipper/blob/master/uTinyRipperCore/Converters/Classes/AnimationClip/CustomCurveResolver.cs']};
await fs.writeFile(path.join(ROOT, 'data/arkpedia-lappland-effect-animations.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({counts:manifest.counts, properties:manifest.properties, bytes:manifest.artifact.bytes}));
