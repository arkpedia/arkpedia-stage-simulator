// SPDX-License-Identifier: GPL-3.0-or-later
import { magicCircuitDefinition, traceMagicCircuits, fluxReflectorTurns } from '../../../shared/arkpedia/device-runtime.js';
import { SUMMON_SPECIFIES_DIRECTION } from '../../../shared/arkpedia/summon-build-conditions.js';
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
export class StageMagicCircuit {
  constructor(b, devices, geometry) {
    this.battle=b;this.entries=new Map();this.exclusions=new Map();this.rows=geometry.rows;this.cols=geometry.cols;this.signature=null;this.field=null;
    for(const d of devices) {
      if(!stageDeviceSpec(d)?.magicCircuit)continue;
      const spec=magicCircuitDefinition(d.instance, d.key),id=`stage-device:${d.key}:${d.row}:${d.col}`;
      const unit=b.spawnDevice(d.key,d.row,d.col,{name:d.name,hp:spec.hp,blockCnt:0,dir:spec.direction});
      if(!unit)throw Error(`Occupied Flux device tile: ${id}`);
      unit.def.profession='TRAP';unit.deploymentSlotCost=0;unit.mem.stageDeviceId=id;
      if(spec.surfaceOnly)unit.mem.stageSurfaceOnly=true;
      b.addBuff(unit,{key:'stage:magicCircuit',persist:true,flags:{invulnerable:true,untargetable:true,noMove:true,noDisplace:true,disarm:true}});
      this.entries.set(id,{id,unit,spec,name:d.name,row:d.row,col:d.col,sp:0,activated:false,state:spec.resonator?'uncharged':'active'});
    }
    b.on('deploy',()=>this.refresh(),{priority:300});b.on('death',()=>this.refresh());
    b.on('tick',({dt})=>{this.refresh();this.charge(dt);},{priority:300});this.refresh();
  }
  refresh() {
    const b=this.battle,sources=[...this.entries.values()].filter(e=>!e.spec.resonator&&!e.spec.reflector&&e.unit.alive&&e.unit.deployed)
      .map(e=>({id:e.id,row:e.unit.tileR,col:e.unit.tileC,direction:e.unit.dir}));
    const operators=b.allyUnits.filter(u=>u.kind==='op'&&u.alive&&u.deployed&&!u.hidden&&!u.s.flags.untargetable&&b.allySelectable(u));
    const redirectors=new Map(operators.map(u=>[`${u.tileR},${u.tileC}`,u.dir]));
    for(const e of this.entries.values())if(e.spec.reflector&&e.unit.alive&&e.unit.deployed)
      redirectors.set(`${e.row},${e.col}`,fluxReflectorTurns(e.unit.dir));
    const stops=new Set();
    for (const e of this.entries.values()) if (e.spec.resonator) {
      if (!e.activated) { if(e.unit.alive&&e.unit.deployed)stops.add(`${e.row},${e.col}`); continue; }
      const u=b.allyUnits.find(u=>u.tileR===e.row&&u.tileC===e.col&&u.alive&&u.deployed
        && this.eligible(u));
      if(u)sources.push({id:`${e.id}:emitter:${u.id}:${u.deploySeq}`,row:e.row,col:e.col,direction:u.kind==='op'||SUMMON_SPECIFIES_DIRECTION[u.defId] === true?u.dir:'LEFT'});
    }
    const excluded=new Set([...this.exclusions.values()].flat());
    const signature=JSON.stringify([sources,[...redirectors],[...stops],[...excluded]]);
    if(signature===this.signature)return;
    this.signature=signature;this.field=traceMagicCircuits(this.field,sources,redirectors,this.rows,this.cols,stops,excluded);
    for(const e of this.entries.values())if(!e.spec.resonator)e.state=e.unit.alive?'active':'spent';
  }
  exclude(owner, tiles) {
    if(tiles?.length)this.exclusions.set(owner,tiles.map(([r,c])=>`${r},${c}`));
    else this.exclusions.delete(owner);
    this.refresh();
  }
  charge(dt) {
    const reached=new Set([...this.entries.values()].filter(e=>this.field.occupied.has(`${e.row},${e.col}`)));
    for (const e of this.entries.values()) {
      if (!e.spec.resonator || e.activated || !e.unit.alive || !e.unit.deployed) continue;
      const connected=reached.has(e);
      e.state=connected?'charging':'uncharged';
      if (!connected) continue;
      e.sp=Math.min(e.spec.spCost,e.sp+dt);
      if(e.sp+1e-9>=e.spec.spCost){
        e.sp=e.spec.spCost;e.activated=true;e.state='activated';
        this.battle._remove(e.unit,'retreat',null,true);
        this.refresh();
      }
    }
  }
  coversPosition(row,col) {
    this.refresh();return this.field.occupied.has(`${Math.round(row)},${Math.round(col)}`);
  }
  nextConnected(origin, direction, visited) {
    if (!this.contains(origin)) return null;
    const key = `${Math.round(origin.y)},${Math.round(origin.x)}`;
    const route = this.field.routes.get(this.field.occupied.get(key));
    const index = route.path.findIndex(p => `${p.row},${p.col}` === key);
    const position = u => route.path.findIndex(p => p.row === Math.round(u.y) && p.col === Math.round(u.x));
    return this.battle.allyUnits.filter(u => u !== origin && !visited.has(u) && this.contains(u))
      .map(u => ({ unit: u, index: position(u) })).filter(p => p.index >= 0 && (p.index - index) * direction > 0)
      .sort((a, b) => (a.index - b.index) * direction || a.unit.id - b.unit.id)[0]?.unit ?? null;
  }
  eligible(u) {
    return u.alive&&u.deployed&&u.side==='ally'&&(['op','token'].includes(u.kind)||u.kind==='device'&&!!u.mem.regularSummonCard)
      &&!u.hidden&&!u.s.flags.untargetable&&this.battle.allySelectable(u);
  }
  contains(u) {
    if(!this.eligible(u))return false;
    return this.coversPosition(u.y,u.x);
  }
}
