// SPDX-License-Identifier: GPL-3.0-or-later
import { artBase, fetchArtFile } from '/shared/arkpedia/stage-art.js';
import { createParticleBurst, validateParticlePack, rotateVector, unityToBoard, skillBurstKey } from '/shared/arkpedia/particles.js';
const P=globalThis.PIXI;

export async function loadSkillParticles(art) {
  const base=artBase(art);
  const pack=JSON.parse(new TextDecoder().decode(await fetchArtFile(base,art.pack)));
  validateParticlePack(pack);
  const files=base+art.pack.path.slice(0,art.pack.path.lastIndexOf('/')+1), textures={}, bitmaps=[];
  const dispose=()=>{Object.values(textures).forEach(t=>t.destroy(true));bitmaps.forEach(b=>b.close());};
  try {
    for (const [key,entry] of Object.entries(pack.textures)) {
      const bytes=await fetchArtFile(files,entry);
      const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/webp'}));
      bitmaps.push(bitmap);
      textures[key]=P.Texture.from(bitmap,{alphaMode:P.ALPHA_MODES.UNPACK});
    }
    return {pack,textures,bindings:art.bindings,dispose};
  } catch(error) { dispose(); throw error; }
}

export class SkillParticleLayer {
  constructor(stage, assets) {
    this.stage=stage; this.assets=assets; this.instances=[]; this.seen=new Set();
  }
  trigger(unit) {
    if (!skillBurstKey(unit,this.assets.bindings)) return;
    const token=`${unit.id}:${unit.skill.activations}`;
    if (this.seen.has(token)) return;
    this.seen.add(token);
    this.add(unit.id,unit.skill.lastStart, [unit.x,unit.y], unit.skill.activations);
  }
  // Also used by the source-effect preview; it cannot mutate the battle.
  add(id,time,position,seed=1) {
    const burst=createParticleBurst(this.assets.pack,seed), meshes=new Map();
    this.instances.push({id,time,position,burst,meshes});
  }
  clear() {
    for (const i of this.instances) for (const m of i.meshes.values()) m.destroy();
    this.instances=[]; this.seen.clear();
  }
  render(time, projection, heightAt) {
    this.instances=this.instances.filter(i=>{
      const age=time-i.time;
      if (age>=i.burst.duration) {
        for (const m of i.meshes.values()) m.destroy();
        return false;
      }
      const live=new Set();
      for (const p of i.burst.sample(age)) {
        live.add(p.id);
        let mesh=i.meshes.get(p.id);
        if (!mesh) {
          mesh=new P.SimpleMesh(this.assets.textures[p.material.texture],new Float32Array(8),
            new Float32Array([0,1,1,1,1,0,0,0]),new Uint16Array([0,1,2,0,2,3]));
          mesh.blendMode=p.material.blend==='additive'?P.BLEND_MODES.ADD:P.BLEND_MODES.NORMAL;
          this.stage.addChild(mesh); i.meshes.set(p.id,mesh);
        }
        const [col,row]=i.position, origin=[col+p.position[0],row+p.position[1],heightAt(Math.round(row),Math.round(col))+.6+p.position[2]];
        const centre=projection.project(...origin), c=Math.cos(p.rotation), s=Math.sin(p.rotation);
        const vertices=mesh.vertices;
        for (const [index,[x,y]] of [[-1,-1],[1,-1],[1,1],[-1,1]].entries()) {
          const rx=(x*c-y*s)*p.size/2, ry=(x*s+y*c)*p.size/2;
          if (p.alignment===0) {
            vertices[index*2]=centre.x+rx*centre.s; vertices[index*2+1]=centre.y-ry*centre.s;
          } else {
            const v=unityToBoard(rotateVector([rx,ry,0],p.transform.rotation));
            const screen=projection.project(...origin.map((n,j)=>n+v[j]));
            vertices[index*2]=screen.x; vertices[index*2+1]=screen.y;
          }
        }
        mesh.tint=p.color.slice(0,3).reduce((n,v)=>(n<<8)|Math.round(Math.max(0,Math.min(1,v))*255),0);
        mesh.alpha=Math.max(0,Math.min(1,p.color[3])); mesh.visible=p.size>0 && mesh.alpha>0;
        mesh.zIndex=2000+centre.y;
      }
      for (const [id,m] of i.meshes) if (!live.has(id)) {m.destroy();i.meshes.delete(id);}
      return true;
    });
  }
  dispose() { this.clear(); this.assets.dispose(); }
}
