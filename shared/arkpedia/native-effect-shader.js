// SPDX-License-Identifier: GPL-3.0-or-later
// Port native GLES stage wrappers/binding qualifiers to WebGL2. Expressions,
// uniforms, varyings and fragment outputs remain the original source text.
export function webglEffectProgram(source) {
  const middle = '\n#endif\n#ifdef FRAGMENT\n#version 300 es\n';
  const prefix = '#ifdef VERTEX\n#version 300 es\n';
  if (!source.startsWith(prefix) || source.split(middle).length !== 2 ||
      !/\n#endif\n\s*$/.test(source) || source.includes('\0')) {
    throw new Error('Unexpected native GLES stage wrappers');
  }
  const [vertex, fragment] = source.slice(prefix.length).split(middle);
  const port = stage => {
    const location = '#define UNITY_LOCATION(x) layout(location = x)';
    const binding = '#define UNITY_BINDING(x) layout(binding = x, std140)';
    if (stage.split(location).length !== 2 || stage.split(binding).length !== 2) {
      throw new Error('Unexpected native GLES binding macros');
    }
    return stage.replace(location, '#define UNITY_LOCATION(x)')
      .replace(binding, '#define UNITY_BINDING(x) layout(std140)');
  };
  return {vertex:port(vertex), fragment:port(fragment.replace(/\n#endif\n\s*$/, '\n'))};
}

export function selectEffectProgram(shader, keywords) {
  const wanted = [...new Set(keywords)].sort();
  const programs = Object.values(shader.programs).filter(p=>p.keywords.length===wanted.length &&
    [...p.keywords].sort().every((v,i)=>v===wanted[i]));
  if (programs.length !== 1) throw new Error('Missing or ambiguous original material keyword variant');
  return programs[0];
}

// Include integer toggles: leaving them unset changes native branches even when
// the GLSL program compiles successfully. Reject unknown uniform types instead
// of silently relying on WebGL's zero-initialized values.
export function effectUniformDeclarations(port) {
  const declarations=new Map();
  for(const stage of [port.vertex,port.fragment])for(const m of stage.matchAll(/uniform\s+(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+(\w+)(?:\[(\d+)\])?\s*;/g)){
    const [,type,name,count]=m;
    if(!['float','int','vec2','vec3','vec4','sampler2D'].includes(type))throw new Error('Unsupported native uniform type '+type);
    const d={type,name,count:count?Number(count):null};
    if(declarations.has(name)&&JSON.stringify(declarations.get(name))!==JSON.stringify(d))throw new Error('Conflicting native uniform declaration '+name);
    declarations.set(name,d);
  }
  return [...declarations.values()];
}
