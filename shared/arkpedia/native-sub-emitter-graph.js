// SPDX-License-Identifier: GPL-3.0-or-later
// Original birth links and accepted-birth triggers. Child emission clocks,
// parent-particle motion/velocity and shared child capacity still need dispatch.
export function createSubEmitterGraph(pack){
  if(!pack?.records)throw Error('Missing native sub-emitter records');
  const links=new Map(),incoming=new Map();
  for(const[id,r]of Object.entries(pack.records))if(r.type==='ParticleSystem'&&r.data.SubModule?.enabled){
    const module=r.data.SubModule;
    if(!Array.isArray(module.subEmitters))throw Error('Invalid native sub-emitter slots');
    const rows=module.subEmitters.map((slot,index)=>{
      if(!Number.isInteger(slot.type)||slot.type<0||slot.type>4||!Number.isInteger(slot.properties)||slot.properties<0||slot.properties>31
        ||!Number.isFinite(slot.emitProbability)||slot.emitProbability<0||slot.emitProbability>1)throw Error('Invalid native sub-emitter event/inheritance/probability');
      const pointer=slot.emitter;
      const refs=(r.references??[]).filter(ref=>ref.field==='emitter'&&ref.pointer?.m_FileID===pointer?.m_FileID&&ref.pointer?.m_PathID===pointer?.m_PathID);
      const targets=[...new Set(refs.map(ref=>ref.target))];
      if(targets.length!==1||pack.records[targets[0]]?.type!=='ParticleSystem')throw Error('Unresolved or ambiguous native sub-emitter');
      const child=targets[0];
      if(child===id)throw Error('Cyclic native sub-emitter graph');
      if(!incoming.has(child))incoming.set(child,[]);incoming.get(child).push(id);
      return {slot:index,child,type:slot.type,properties:slot.properties,emitProbability:slot.emitProbability};
    });
    links.set(id,rows);
  }
  const visited=new Set(),active=new Set();
  function visit(id){if(active.has(id))throw Error('Cyclic native sub-emitter graph');if(visited.has(id))return;
    active.add(id);for(const row of links.get(id)??[])visit(row.child);active.delete(id);visited.add(id);}
  for(const id of links.keys())visit(id);
  return {
    parents(child){return [...new Set(incoming.get(child)??[])];},
    links(parent){return (links.get(parent)??[]).map(row=>({...row}));},
    triggers(parent,births){
      if(!links.has(parent)||!Array.isArray(births)||births.length>100000)throw Error('Invalid native sub-emitter birth input');
      if(links.get(parent).some(row=>row.type!==0||row.properties!==0||row.emitProbability!==1))
        throw Error('Native sub-emitter event/inheritance/probability needs dispatch');
      const source=pack.records[parent].data;
      if(!Number.isFinite(source.simulationSpeed)||source.simulationSpeed<=0)throw Error('Invalid native sub-emitter simulation speed');
      const ids=new Set();let previous=-Infinity;
      return births.flatMap(p=>{
        if(!Number.isSafeInteger(p.id)||p.id<0||ids.has(p.id)||!Number.isFinite(p.birthTime)||p.birthTime<previous
          ||!Number.isFinite(p.lifetime)||p.lifetime<=0||p.age!==0)throw Error('Invalid native accepted parent birth');
        ids.add(p.id);previous=p.birthTime;
        return links.get(parent).map(row=>({parent,particle:p.id,...row,time:p.birthTime,
          parentDeathTime:p.birthTime+p.lifetime/source.simulationSpeed}));
      });
    },
    scope:{birthScheduling:true,childEmissionPlaying:false,compiledFrameParity:false}
  };
}
