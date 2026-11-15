// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import native from '../data/arkpedia-device-native-source.json' with {type:'json'};
import orientation from '../data/arkpedia-flux-reflector-source.json' with {type:'json'};
import { FLUX_REFLECTOR_PORTS, fluxReflectorTurns, fluxReflectorNativeReviewed, magicCircuitDefinition, traceMagicCircuits } from '../shared/arkpedia/stage-magic-circuit.js';
import { DIRS, dirVec, oppositeDir } from '../shared/direction.js';
import { StageMagicCircuit } from '../server/sim/content/arkpedia-stage-magic-circuit.js';
import { makeBattle } from './helpers/battleHarness.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

test('Whisperer requires the native two-entry passive and refuses altered source contracts',()=>{
 assert.deepEqual(FLUX_REFLECTOR_PORTS,orientation.ports);
 assert.equal(fluxReflectorNativeReviewed(),true);
 for(const mutate of [e=>e.templates.trap_magicturn_t.eventToActions.ON_BUFF_START[0]._isTwoEntriesOnly=false,
  e=>e.prefabs.trap_063_magicturn.components.find(c=>'_withdrawable'in c.data).data._withdrawable=1,
  e=>e.templates.trap_magicturn_t.eventToActions.ON_ENTER_MAGICCIRCUIT[0]._buff.attributes.abnormalFlags.push('STUNNED'),
  e=>e.prefabs.trap_063_magicturn.components.find(c=>'_modes'in c.data).data._modes[0].m_PathID='0']) {
  const e=structuredClone(native);mutate(e);assert.equal(!!fluxReflectorNativeReviewed(e),false);
 }
 assert.equal(magicCircuitDefinition({level:30,skillLevel:1,direction:'LEFT'},'trap_063_magicturn').reflector,true);
 assert.throws(()=>magicCircuitDefinition({level:1,skillLevel:1,direction:'DIAGONAL'},'trap_063_magicturn'),/Whisperer/);
});
test('every fixed corner connects its two openings both ways, and unrelated approaches continue straight',()=>{
 for(const direction of DIRS)for(const incoming of DIRS){
  const [dr,dc]=dirVec(incoming),ports=FLUX_REFLECTOR_PORTS[direction],entry=oppositeDir(incoming);
  const expected=ports.includes(entry)?ports.find(p=>p!==entry):incoming;
  const f=traceMagicCircuits(null,[{id:'beam',row:3-dr,col:3-dc,direction:incoming}],new Map([['3,3',fluxReflectorTurns(direction)]]),7,7);
  const route=f.routes.get('beam').path,index=route.findIndex(p=>p.row===3&&p.col===3),[er,ec]=dirVec(expected);
  assert.equal(route[index].direction,expected,`${direction}/${incoming}`);
  assert.deepEqual([route[index+1].row,route[index+1].col],[3+er,3+ec]);
 }
});
const device=(key,name,row,col,direction)=>({key,name,row,col,kind:'device',hidden:false,instance:{level:1,skillLevel:1,direction}});
function fixture(source=true){
 const ds=[device('trap_063_magicturn',"L-7 'Whisperer'",10,6,'LEFT')];
 if(source)ds.unshift(device('trap_062_magicstart',"'Tuba'",10,3,'RIGHT'));
 const h=makeBattle({content:'none',units:[],autoFinish:false,setup:b=>{b.stageMagicCircuit=new StageMagicCircuit(b,ds,{rows:19,cols:21});}});
 h.b.start();return {...h,field:h.b.stageMagicCircuit};
}
test('a reflector never emits its own Flux; removing a reached reflector restores the original straight route',()=>{
 assert.equal(fixture(false).field.field.routes.size,0);
 const {b,field}=fixture(),e=[...field.entries.values()].find(e=>e.spec.reflector);
 assert.equal(field.field.routes.size,1);assert.equal(field.coversPosition(11,6),true);assert.equal(field.coversPosition(10,7),false);
 assert.equal(e.unit.deploymentSlotCost,0);assert.equal(b._occ[10*21+6],e.unit);
 b.dealDamage(null,e.unit,{amount:1e6,type:'true'});assert.equal(e.unit.hp,100);
 b._remove(e.unit,'retreat',null,true);field.refresh();assert.equal(field.coversPosition(11,6),false);assert.equal(field.coversPosition(10,7),true);
 assert.deepEqual(b.errors,[]);
});
test('reflector turns preserve existing intersection ownership and finite loops',()=>{
 const turns=new Map([['1,3',fluxReflectorTurns('LEFT')],['3,3',fluxReflectorTurns('DOWN')],['3,1',fluxReflectorTurns('RIGHT')]]);
 const source={id:'a',row:1,col:1,direction:'RIGHT'};
 const f=traceMagicCircuits(null,[source],turns,7,7);
 assert.equal(f.routes.get('a').path.length,8);
 const vertical={id:'b',row:2,col:4,direction:'UP'};
 const shared=traceMagicCircuits(null,[source,vertical],new Map(),7,7);
 const rerouted=traceMagicCircuits(shared,[source,vertical],new Map([['1,2',fluxReflectorTurns('LEFT')],['3,2',fluxReflectorTurns('RIGHT')]]),7,7);
 assert.equal(rerouted.occupied.get('3,4'),'b');
});
test('original LE-EX-4 reflector facing turns its initial Tuba beam upward and shares ordinary stage compilation',async()=>{
 const c=await loadContentContext(),p=await planStage(c,'le-ex-4');assert.deepEqual(p.blockers,[]);
 const ds=p.stage.devices.filter(d=>d.key==='trap_063_magicturn');assert.deepEqual(ds.map(d=>d.instance.direction),['LEFT','RIGHT']);
 const data={...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}};
 const b=new StandardBattle(data,{operators:Object.values(data.operators).slice(0,3).map(defaultBuild)});
 assert.equal(b.stageMagicCircuit.coversPosition(3,5),true);assert.equal(b.stageMagicCircuit.coversPosition(1,5),false);
 assert.deepEqual(b.errors,[]);
});
