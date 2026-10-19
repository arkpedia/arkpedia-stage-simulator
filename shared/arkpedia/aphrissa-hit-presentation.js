// SPDX-License-Identifier: GPL-3.0-or-later
// Literal source hit roots, with a deliberately explicit local delivery policy.
import {createEffectPose} from './native-effect-pose.js';
import {APHRISSA_BEAM_PACK} from './aphrissa-beam-presentation.js';
export const APHRISSA_HIT_CONTRACT=Object.freeze({heldOnly:true,nativeDispatchVerified:false,nativeMountMappingVerified:false,
  nativeFinishDispatchVerified:false,frameParity:false,retention:8,
  policy:'Observe only the exact normalized main-damage descriptor currently owned by an accepted attack delivery. The local damaged receipt includes shield-absorbed and lethal hits, excludes missed/protected/cancelled deliveries and independent S3 producer damage. Freeze the recipient position at that receipt; caller supplies the target mount and orientation. Retain each full nonlooping source prefab for its conservative eight-second particle bound, independently of subsequent target movement/death. Source owner retirement cancels review presentation. This is a local receipt/placement/cleanup policy, not compiled native hit/Finish semantics.'});
export const APHRISSA_HIT_STYLES=Object.freeze(Object.fromEntries(['normal','s1','s2','s3'].map(mode=>[mode,Object.freeze({
  root:mode==='s2'?'aphris_skill_02_hit_01':mode==='s3'?'aphris_skill_03_hit_01':'aphris_attack_01_hit_01',retention:8})])));
const id=v=>typeof v==='string'&&!!v||Number.isSafeInteger(v)&&v>0;
export function validateAphrissaHit(t){
  const style=typeof t?.mode==='string'&&Object.hasOwn(APHRISSA_HIT_STYLES,t.mode)?APHRISSA_HIT_STYLES[t.mode]:null;
  if(!style||typeof t.id!=='string'||!t.id||!id(t.ownerId)||!id(t.targetId)
    ||!Number.isSafeInteger(t.ownerLife)||t.ownerLife<1||!Number.isSafeInteger(t.targetLife)||t.targetLife<1
    ||!Number.isSafeInteger(t.attackId)||t.attackId<1||t.root!==style.root
    ||!Number.isFinite(t.startedAt)||t.startedAt<0||!Number.isFinite(t.x)||!Number.isFinite(t.y)
    ||!Number.isSafeInteger(t.row)||!Number.isSafeInteger(t.col))throw Error('Invalid held Aphrissa hit receipt');
  return style;
}
export function validateAphrissaHitSources(pack,animations){
  const fail=()=>{throw Error('Changed original Aphrissa hit prefab');},records=pack.records,result=[];
  if(animations.sourcePackSha256!==APHRISSA_BEAM_PACK)fail();
  for(const root of new Set(Object.values(APHRISSA_HIT_STYLES).map(s=>s.root))){
    const pose=createEffectPose(pack,animations,root),objects=new Set([...pose.nodes.values()].map(n=>n.gameObject)),
      components=[...objects].flatMap(go=>(records[go].references??[]).filter(r=>r.field==='component').map(r=>r.target)),
      fx=(records[pack.roots[root]].references??[]).filter(r=>r.field==='component').map(r=>r.target)
        .filter(id=>records[id].type==='MonoBehaviour'&&Object.hasOwn(records[id].data,'_isLoop'));
    if(pose.instances.length||fx.length!==1||components.some(id=>records[id].type==='Animator'&&records[id].data.m_Enabled))fail();
    const d=records[fx[0]].data;
    for(const [key,value]of Object.entries({m_Enabled:1,_isLoop:0,_holdByOwner:0,_delayToFinish:.5,_rotateType:0,
      _spawnLocation:2,_heightOffset:0,_overwriteHeight:0,_useBodyRotation:0,_delayToPlay:0,_randomPlayDelay:0,_maxLifetime:-1}))if(d[key]!==value)fail();
    const particles=components.filter(id=>records[id].type==='ParticleSystem');
    if(particles.length!==(root.includes('skill_03')?27:19))fail();
    // Conservative bound includes even inactive / non-emitting helper systems.
    // Only the source's constant and two-constant channels occur in these roots.
    for(const id of particles){const p=records[id].data,upper=c=>{
      if(![0,3].includes(c?.minMaxState)||!Number.isFinite(c.scalar)||c.scalar<0
        ||c.minMaxState===3&&(!Number.isFinite(c.minScalar)||c.minScalar<0))fail();
      return c.minMaxState===3?Math.max(c.scalar,c.minScalar):c.scalar;
    };
      if(p.looping||!Number.isFinite(p.lengthInSec)||p.lengthInSec<0
        ||upper(p.startDelay)+p.lengthInSec+upper(p.InitialModule.startLifetime)>APHRISSA_HIT_CONTRACT.retention)fail();
    }
    result.push({root,fx:fx[0],particles:particles.length,retention:APHRISSA_HIT_CONTRACT.retention});
  }
  return result;
}
