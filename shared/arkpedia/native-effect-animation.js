// SPDX-License-Identifier: GPL-3.0-or-later
// Decode the stripped streamed/constant curves used by the pinned original
// Lappland effects. This samples source channels; it does not execute Unity's
// Animator FSM, apply renderer properties, or certify compiled-frame parity.
// Format references: AssetStudio/Classes/AnimationClip.cs (StreamedClip and
// FindBinding); coefficients describe a cubic in seconds from the current key.
const fail = message => { throw new Error(`Native effect animation: ${message}`); };
const finite = (value, label) => {
  if (!Number.isFinite(value)) fail(`non-finite ${label}`);
  return value;
};
const count = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) fail(`invalid ${label}`);
  return value;
};

export function decodeEffectClip(source) {
  for (const name of ['m_RotationCurves', 'm_CompressedRotationCurves', 'm_EulerCurves',
    'm_PositionCurves', 'm_ScaleCurves', 'm_FloatCurves', 'm_PPtrCurves']) {
    if (!Array.isArray(source[name]) || source[name].length) fail(`unsupported ${name}`);
  }
  const muscle = source.m_MuscleClip, clip = muscle?.m_Clip?.data;
  if (!clip) fail('missing stripped clip');
  const start = finite(muscle.m_StartTime, 'start'), stop = finite(muscle.m_StopTime, 'stop');
  if (stop <= start || typeof muscle.m_LoopTime !== 'boolean') fail('invalid clip clock');
  const stream = clip.m_StreamedClip, dense = clip.m_DenseClip, constant = clip.m_ConstantClip;
  const streamedCount = count(stream.curveCount, 'streamed curve count');
  // All ten pinned clips use zero dense curves. Do not invent interpolation for
  // additional formats until a source-backed implementation is reviewed.
  if (dense.m_CurveCount !== 0 || dense.m_SampleArray.length) fail('unsupported dense curves');
  if (!Array.isArray(constant.data)) fail('invalid constant curves');
  const constants = constant.data.map(v => finite(v, 'constant value'));
  const bindings = source.m_ClipBindingConstant?.genericBindings;
  if (!Array.isArray(bindings) || source.m_ClipBindingConstant.pptrCurveMapping.length) {
    fail('unsupported pointer bindings');
  }
  const channels = [];
  const decodedBindings = bindings.map((binding, bindingIndex) => {
    if (binding.isPPtrCurve || binding.isIntCurve || binding.script.m_PathID !== '0') {
      fail('unsupported pointer, integer or script curve');
    }
    const size = binding.typeID === 4 ? ({1:3, 2:4, 3:3, 4:3}[binding.attribute] ?? 0) : 1;
    if (!size) fail('unsupported transform attribute');
    const offset = channels.length;
    for (let component = 0; component < size; component++) {
      const index = channels.length;
      channels.push({bindingIndex, component, kind:index < streamedCount ? 'streamed' : 'constant',
        ...(index < streamedCount ? {keys:[]} : {value:constants[index - streamedCount]})});
    }
    return {...binding, offset, size};
  });
  if (channels.length !== streamedCount + constants.length) fail('binding/channel count mismatch');
  if (!Array.isArray(stream.data)) fail('invalid streamed words');
  const bytes = new ArrayBuffer(stream.data.length * 4), view = new DataView(bytes);
  stream.data.forEach((word, index) => {
    if (!Number.isInteger(word) || word < 0 || word > 0xffffffff) fail('invalid streamed word');
    view.setUint32(index * 4, word, true);
  });
  let offset = 0, previousTime = -Infinity, frames = 0, terminal = false;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength || terminal) fail('truncated or trailing stream');
    const time = view.getFloat32(offset, true), size = view.getInt32(offset + 4, true);
    offset += 8;
    if (size < 0 || offset + size * 20 > bytes.byteLength || !(time > previousTime)) {
      fail('invalid frame ordering or length');
    }
    const sentinel = frames === 0;
    if (sentinel && (time !== -3.4028234663852886e38 || size !== streamedCount)) {
      fail('missing initial sentinel');
    }
    terminal = time === Infinity;
    if (terminal && size !== 0) fail('invalid terminal sentinel');
    if (!sentinel && !terminal && (!Number.isFinite(time) || time < start || time > stop)) {
      fail('frame outside clip clock');
    }
    const seen = new Set();
    for (let i = 0; i < size; i++) {
      const index = view.getInt32(offset, true);
      const coefficients = Array.from({length:4}, (_, j) => finite(view.getFloat32(offset + 4 + j * 4, true), 'coefficient'));
      offset += 20;
      if (index < 0 || index >= streamedCount || seen.has(index)) fail('invalid or duplicate channel index');
      seen.add(index);
      if (!sentinel) channels[index].keys.push({time, coefficients});
    }
    previousTime = time;
    frames++;
  }
  if (!terminal || frames < 3) fail('incomplete stream');
  for (const channel of channels.slice(0, streamedCount)) {
    if (!channel.keys.length || channel.keys[0].time !== start) fail('missing initial channel key');
  }
  return {name:source.m_Name, start, stop, loop:muscle.m_LoopTime, bindings:decodedBindings,
    channels, sourceFrames:frames, streamedWords:stream.data.length};
}

export function sampleEffectClip(clip, time, {loop = clip.loop} = {}) {
  finite(time, 'sample time');
  if (typeof loop !== 'boolean') fail('invalid loop override');
  let t = Math.max(clip.start, time);
  if (loop && t >= clip.stop) t = clip.start + (t - clip.start) % (clip.stop - clip.start);
  else t = Math.min(t, clip.stop);
  return clip.channels.map(channel => {
    if (channel.kind === 'constant') return channel.value;
    const keys = channel.keys;
    let lo = 0, hi = keys.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid].time <= t) lo = mid;
      else hi = mid;
    }
    const key = keys[lo], dt = t - key.time, [a,b,c,d] = key.coefficients;
    // The last authored value is held. A zero-coefficient segment is a step,
    // not a linear blend to the next key. Preserve each channel's sparse clock.
    return lo === keys.length - 1 ? d : ((a * dt + b) * dt + c) * dt + d;
  });
}
