// SPDX-License-Identifier: GPL-3.0-or-later
// Source-only bridge. Selected browsers receive component references instead.
import evidence from '../../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import {compileNativeBuffProgram} from './behavior-native-compiler.js';
const programs=new Map();
export function nativeBuffProgram(key){
  if(!programs.has(key))programs.set(key,compileNativeBuffProgram(key,k=>evidence.templates[k]));
  return programs.get(key);
}
export function nativeBuffProgramSupported(key,native){
  try{compileNativeBuffProgram(key,k=>native.$template(k));return true;}catch{return false;}
}
