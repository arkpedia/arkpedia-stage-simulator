// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import tables from'../data/candidates/arkpedia-stage-predefined-module-tables.json' with{type:'json'};
import native from'../data/candidates/arkpedia-stage-predefined-module-native.json' with{type:'json'};
import{jsonSourceDigest}from'../shared/arkpedia/source-digest.js';
const reference=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('portable JSON SHA-256 matches Node across padding boundaries, UTF-8 and multi-block inputs',()=>{
 const values=[null,true,false,0,-1,1.5,{},[],{name:'桑葚 🦉',lone:'\ud800',nested:[null,{value:'\n\0'}]},'x'.repeat(1e5)];
 for(let n=0;n<140;n++)values.push('a'.repeat(n));
 for(const value of values)assert.equal(jsonSourceDigest(value),reference(value));
});
test('portable SHA-256 reproduces every retained predefined module, prefab, template and card receipt',()=>{
 for(const value of [...Object.values(tables.modules),...Object.values(native.prefabs),...Object.values(native.templates),...Object.values(tables.stages).flatMap(s=>s.predefines.characterCards??[])])
  assert.equal(jsonSourceDigest(value),reference(value));
});
