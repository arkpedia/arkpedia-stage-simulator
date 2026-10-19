// SPDX-License-Identifier: GPL-3.0-or-later
// Visual receipts only. This owner never changes targets, damage, SP or ammo.
import {APHRISSA_ID as ID,aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {aphrissaRayCells,APHRISSA_RAY_CONTRACT} from './arkpedia-aphrissa-ray.js';
import {aphrissaReviewSupport} from '../../../shared/arkpedia/aphrissa-review-operator.js';
import {APHRISSA_BEAM_CONTRACT,APHRISSA_BEAM_STYLES,validateAphrissaBeamTrack} from '../../../shared/arkpedia/aphrissa-beam-presentation.js';
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const due=(now,at)=>now+1e-7>=at;
export function prepareAphrissaLinePresentation(b,u,{contract}={}){
  if(contract!==APHRISSA_BEAM_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.aphrissaLinePresentation
    ||!aphrissaReviewSupport(ID,b.regularReviewCandidates))throw Error('Explicit held Aphrissa beam presentation required');
  const n=aphrissaNativeInputs();
  for(const [mode,fx]of [['normal',n.ordinaryLineFx],['s1',n.s1LineFx],['s1',n.s1DownLineFx],
    ['s2',n.s2LineFx],['s3',n.s3LineFx],['s3',n.s3DownLineFx]]){
    const style=APHRISSA_BEAM_STYLES[mode];
    if(fx._lineEffectKey!==style.root||fx._emitOnEvent!==4||fx._progressiveDraw!==Number(style.progressive)
      ||fx._effectReuse!==Number(style.reuse)||fx._alwaysUseNewRange!==Number(style.reuse)
      ||fx._startMountType!==style.startMountType||fx._waypointMountType!==style.waypointMountType
      ||fx._waypointUseFixedHeight!==1||fx._waypointFixedHeight!==style.waypointFixedHeight)
      throw Error('Changed original Aphrissa beam dispatch inputs');
  }
  const owner=new LinePresentation(b,u);u.mem.aphrissaLinePresentation=owner;return owner;
}
class LinePresentation{
  constructor(b,u){Object.assign(this,{b,u,seq:null,stopped:false,records:new Map(),continuous:null,handles:[]});}
  valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq
    &&this.u.mem.aphrissaLinePresentation===this&&!this.u.mem.aphrissaOwner?.stopped;}
  points(ray,style){
    if(!ray?.path?.length||ray.path[0].row!==this.u.tileR||ray.path[0].col!==this.u.tileC)
      throw Error('Missing captured Aphrissa ray path');
    const points=[{role:'start',row:this.u.tileR,col:this.u.tileC,unitId:this.u.id,life:this.seq,mountType:style.startMountType}];
    for(const cell of ray.path)if(cell.turnIndex!==undefined){
      const turn=ray.turns[cell.turnIndex];
      if(!turn||turn.row!==cell.row||turn.col!==cell.col)throw Error('Changed captured Aphrissa ray waypoint');
      const last=points.at(-1);
      if(last.row!==cell.row||last.col!==cell.col)points.push({role:'waypoint',row:cell.row,col:cell.col,
        unitId:turn.sourceId,life:turn.sourceLife,mountType:style.waypointMountType,fixedHeight:style.waypointFixedHeight});
    }
    const last=ray.path.at(-1),previous=points.at(-1);
    if(last.row!==previous.row||last.col!==previous.col)points.push({role:'end',row:last.row,col:last.col});
    return points;
  }
  create(mode,key,ray,startedAt=this.b.time){
    const style=APHRISSA_BEAM_STYLES[mode],points=this.points(ray,style);
    if(points.length<2)return null;
    const track={id:`${this.u.id}:${this.seq}:beam:${key}`,ownerId:this.u.id,ownerLife:this.seq,mode,
      root:style.root,clip:style.clip.id,startedAt,clipStartedAt:startedAt,stage:'active',points};
    validateAphrissaBeamTrack(track);
    const record={track};this.records.set(track.id,record);return record;
  }
  onAttack(controller,p){
    if(!this.valid()||controller.u!==this.u||controller.phase!==p||!p?.accepted||!controller.valid())return;
    if(!Number.isSafeInteger(p.attackId)||p.attackId<1)throw Error('Missing accepted Aphrissa attack identity');
    const mode=controller===this.u.mem.aphrissaOwner.attacks?'s3':controller===this.u.mem.aphrissaOwner.s1Attacks?'s1':'normal';
    if(controller!==this.u.mem.aphrissaOwner.ordinary&&controller!==this.u.mem.aphrissaOwner.attacks
      &&controller!==this.u.mem.aphrissaOwner.s1Attacks)throw Error('Unowned Aphrissa attack presentation');
    const key=`attack:${p.attackId}`;
    if(this.records.has(`${this.u.id}:${this.seq}:beam:${key}`))throw Error('Duplicate accepted Aphrissa beam birth');
    this.create(mode,key,p.ray);
  }
  onPulse(controller,p,ray){
    if(!this.valid()||controller!==this.u.mem.aphrissaOwner.beam||!controller.owns(p))return;
    if(this.continuous?.phase!==p){
      if(this.continuous)this.records.delete(this.continuous.record?.track.id);
      this.continuous={phase:p,record:null,startedAt:this.b.time};
    }
    this.syncContinuous(ray);
  }
  syncContinuous(ray){
    const active=this.continuous,points=this.points(ray,APHRISSA_BEAM_STYLES.s2);
    if(points.length<2){if(active.record)this.records.delete(active.record.track.id);active.record=null;return;}
    if(active.record&&this.records.has(active.record.track.id))active.record.track.points=points;
    else active.record=this.create('s2',`s2:${active.phase.activation}`,ray,active.startedAt);
  }
  participantsLive(track){return track.points.filter(p=>p.role==='waypoint').every(p=>this.b.units.some(u=>
    u.id===p.unitId&&u.deploySeq===p.life&&present(u)&&!u.hidden&&u.side===this.u.side));}
  tick(){
    if(!this.valid()){this.stop();return;}
    const active=this.continuous;
    if(active?.phase){
      const beam=this.u.mem.aphrissaOwner.beam;
      if(beam?.current(active.phase)){
        if(!this.u.hidden){
          const ray=aphrissaRayCells(this.b,this.u,{contract:APHRISSA_RAY_CONTRACT,skill2:true,includePath:true});
          this.syncContinuous(ray);
        }
      }else{
        active.phase=null;
        if(active.record){const {track}=active.record;track.stage='end';track.clip=APHRISSA_BEAM_STYLES.s2.end.id;track.clipStartedAt=this.b.time;}
      }
    }
    for(const [id,record]of this.records){
      const t=record.track,s=APHRISSA_BEAM_STYLES[t.mode];
      if((!s.reuse||t.stage==='end')&&due(this.b.time,t.clipStartedAt+(t.stage==='end'?s.end.duration:s.clip.duration))
        ||!this.participantsLive(t))this.records.delete(id);
    }
  }
  snapshot(){
    this.tick();if(this.stopped||this.u.hidden)return [];
    return [...this.records.values()].map(r=>structuredClone(r.track));
  }
  install(){
    if(this.stopped||this.handles.length||this.seq!==null)throw Error('Aphrissa beam presentation cannot be reinstalled');
    this.handles=[this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move){if(this.seq!==null)this.stop();else this.seq=unit.deploySeq;}},{owner:this.u}),
      this.b.on('tick',()=>{if(this.seq!==null)this.tick();},{owner:this.u}),
      this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('battleEnd',()=>this.stop(),{owner:this.u})];
  }
  stop(){if(this.stopped)return;this.stopped=true;this.records.clear();this.continuous=null;
    for(const h of this.handles)this.b.off(h);this.handles=[];}
}
