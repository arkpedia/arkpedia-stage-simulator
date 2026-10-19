// SPDX-License-Identifier: GPL-3.0-or-later
// Source-bound held beam presentation, never normal roster admission.
import animations from '../../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import lines from '../../data/arkpedia-aphrissa-lines.json' with {type:'json'};
export const APHRISSA_BEAM_OWNER='char_4229_aphris';
export const APHRISSA_BEAM_PACK=lines.sourcePackSha256;
const unitId=v=>typeof v==='string'&&v.length>0||Number.isSafeInteger(v)&&v>0;
export const APHRISSA_BEAM_CONTRACT=Object.freeze({
  heldOnly:true,nativeFrameParity:false,nativeProgressiveDrawVerified:false,nativeMountMappingVerified:false,nativeFinishDispatchVerified:false,
  policy:'Capture ordinary/S1/S3 ray participants at the accepted attack marker and sample the original finite clip on world time. S2 starts at a permitted pulse, including an empty pulse, reuses its beam while the actual account/channel owns it, and updates the ray every observation. Channel departure samples original beam/point End clips against the last ray. Complete point prefabs share each captured beam life; a newly observed waypoint starts a fresh point clock, while reused endpoints retain particle age. Point placement histories and shader globals require explicit caller mappings. Owner retirement cancels all presentation. Native mount/rotation, progressive staging, post-finish tails and compiled dispatch remain unverified.'
});
const clip=name=>{
  const found=Object.entries(animations.clips).filter(([,c])=>c.name===name);
  if(found.length!==1)throw Error('Missing original Aphrissa beam clip');
  return Object.freeze({id:found[0][0],duration:found[0][1].stop-found[0][1].start});
};
const point=(root,animation=null,end=null)=>Object.freeze({root,clip:animation?clip(animation):null,end:end?clip(end):null});
if(animations.sourcePackSha256!==APHRISSA_BEAM_PACK)throw Error('Changed Aphrissa beam animation pack');
export const APHRISSA_BEAM_STYLES=Object.freeze(Object.fromEntries(['normal','s1','s2','s3'].map(mode=>{
  const root=mode==='s2'?'aphris_skill_02_line_01':mode==='s3'?'aphris_skill_03_line_01':'aphris_attack_01_line_01';
  if(lines.roots[root]?.length!==8)throw Error('Incomplete original Aphrissa line layers');
  const s2=mode==='s2',s3=mode==='s3',shared='token_aphris_pc_skill_03_buff_01',
    points=Object.freeze({
      start:point(s2?'aphris_skill_02_start_01':s3?'aphris_skill_03_start_01':'aphris_attack_01_start_01',s2?'aphris_skill_02_start_01':null,s2?'aphris_skill_02_start_01_end':null),
      waypoint:point(s2?'token_aphris_pc_skill_02_buff_01':s3?'token_aphris_pc_skill_03_buff_01':'token_aphris_pc_attack_01_buff_01',s2?'aphris_skill_02_line_point_01':shared,s2?'aphris_skill_02_line_point_01_end':null),
      end:point(s2?'aphris_skill_02_line_point_01':s3?'aphris_skill_03_line_point_01':'aphris_attack_line_point_01',s2?'aphris_skill_02_line_point_01':shared,s2?'aphris_skill_02_line_point_01_end':null)
    });
  return [mode,Object.freeze({root,clip:clip(root),end:mode==='s2'?clip(root+'_end'):null,
    points,reuse:mode==='s2',progressive:mode!=='s2',startMountType:2,waypointMountType:1,waypointFixedHeight:.6499999761581421})];
})));

export function validateAphrissaBeamTrack(t){
  const style=typeof t?.mode==='string'&&Object.hasOwn(APHRISSA_BEAM_STYLES,t.mode)?APHRISSA_BEAM_STYLES[t.mode]:null;
  if(!style||typeof t.id!=='string'||!t.id||!unitId(t.ownerId)
    ||!Number.isSafeInteger(t.ownerLife)||t.ownerLife<1||!Number.isFinite(t.startedAt)||t.startedAt<0
    ||!Number.isFinite(t.clipStartedAt)||t.clipStartedAt<t.startedAt||!['active','end'].includes(t.stage)
    ||t.stage==='active'&&t.clipStartedAt!==t.startedAt
    ||t.root!==style.root||t.clip!==(t.stage==='end'?style.end?.id:style.clip.id)
    ||t.stage==='end'&&!style.end||!Array.isArray(t.points)||t.points.length<2)
    throw Error('Invalid held Aphrissa beam track');
  for(const [i,p]of t.points.entries()){
    if(!p||!Number.isSafeInteger(p.row)||!Number.isSafeInteger(p.col)||!['start','waypoint','end'].includes(p.role)
      ||(i===0)!==(p.role==='start')||p.role==='end'&&i!==t.points.length-1)
      throw Error('Invalid Aphrissa beam point');
    if(p.role==='start'&&(p.unitId!==t.ownerId||p.life!==t.ownerLife||p.mountType!==style.startMountType))
      throw Error('Changed Aphrissa start mount ownership');
    if(p.role==='waypoint'&&(!unitId(p.unitId)||!Number.isSafeInteger(p.life)||p.life<1
      ||p.mountType!==style.waypointMountType||p.fixedHeight!==style.waypointFixedHeight))
      throw Error('Changed Aphrissa waypoint ownership/height');
    if(i&&p.row===t.points[i-1].row&&p.col===t.points[i-1].col)throw Error('Duplicate adjacent Aphrissa beam point');
  }
  return style;
}
