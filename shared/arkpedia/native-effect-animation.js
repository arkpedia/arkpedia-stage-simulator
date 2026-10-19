// SPDX-License-Identifier: GPL-3.0-or-later
// Decode the stripped streamed/constant curves used by the pinned original
// effect inputs. This samples source channels; it does not execute Unity's
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
  if (source.m_Legacy === true) return decodeLegacyEulerClip(source);
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
  // Reviewed pinned effect clips use zero dense curves. Do not invent interpolation for
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
  const initial = [];
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
      if (sentinel) initial[index] = coefficients;
      else channels[index].keys.push({time, coefficients});
    }
    previousTime = time;
    frames++;
  }
  if (!terminal || frames < 3) fail('incomplete stream');
  for (const [index, channel] of channels.slice(0, streamedCount).entries()) {
    if (!channel.keys.length || channel.keys[0].time > start) {
      // Native streamed channels may retain their constant sentinel value until
      // a later authored key, or for the whole clip. Preserve that source value
      // without inventing a key at the clip start or extrapolating a future key.
      const coefficients = initial[index];
      if (!coefficients || coefficients.slice(0, 3).some(value => value !== 0))
        fail('unsupported initial sentinel polynomial');
      const authored = muscle.m_ValueArrayDelta?.[index]?.m_Start;
      if (!Number.isFinite(authored) || authored !== coefficients[3]) fail('initial value differs from authored channel start');
      channel.initialValue = coefficients[3];
    }
  }
  return {name:source.m_Name, start, stop, loop:muscle.m_LoopTime, bindings:decodedBindings,
    channels, sourceFrames:frames, streamedWords:stream.data.length};
}

// The recovered legacy wing clip stores unweighted Euler keys directly, with
// no stripped bindings or muscle curves. Its muscle clock is an unused stub.
// Keep literal hierarchy paths and use the authored key extent instead.
function decodeLegacyEulerClip(source) {
  for (const name of ['m_RotationCurves', 'm_CompressedRotationCurves', 'm_PositionCurves',
    'm_ScaleCurves', 'm_FloatCurves', 'm_PPtrCurves']) {
    if (!Array.isArray(source[name]) || source[name].length) fail(`unsupported legacy ${name}`);
  }
  const clip = source.m_MuscleClip?.m_Clip?.data, binding = source.m_ClipBindingConstant;
  if (source.m_Compressed !== false || source.m_MuscleClipSize !== 0 || !clip
    || clip.m_StreamedClip?.curveCount !== 0 || clip.m_StreamedClip.data?.length !== 0
    || clip.m_DenseClip?.m_CurveCount !== 0 || clip.m_DenseClip.m_SampleArray?.length !== 0
    || clip.m_ConstantClip?.data?.length !== 0
    || binding?.genericBindings?.length !== 0 || binding.pptrCurveMapping?.length !== 0) {
    fail('unsupported mixed legacy clip');
  }
  if (source.m_WrapMode !== 2) fail('unsupported legacy wrap mode');
  if (!Array.isArray(source.m_EulerCurves) || !source.m_EulerCurves.length) fail('missing legacy Euler curves');
  const channels = [], bindings = [], paths = new Set();
  let stop = null;
  for (const {path, curve} of source.m_EulerCurves) {
    if (typeof path !== 'string' || paths.has(path)) fail('invalid or duplicate legacy path');
    paths.add(path);
    // Unity's RotationOrder enum maps 4 to ZXY. Other orders and weighted
    // Bezier keys require a separately reviewed source input and evaluator.
    if (curve?.m_RotationOrder !== 4 || curve.m_PreInfinity !== 2 || curve.m_PostInfinity !== 2
      || !Array.isArray(curve.m_Curve) || curve.m_Curve.length < 2) fail('unsupported legacy Euler curve');
    const keys = curve.m_Curve;
    let previous = -Infinity;
    for (const key of keys) {
      if (finite(key.time, 'legacy key time') <= previous || key.weightedMode !== 0)
        fail('invalid legacy key order or weighting');
      previous = key.time;
      for (const field of ['value', 'inSlope', 'outSlope', 'inWeight', 'outWeight'])
        for (const axis of ['x', 'y', 'z']) finite(key[field]?.[axis], `legacy ${field}.${axis}`);
    }
    const end = keys.at(-1).time;
    if (keys[0].time !== 0 || end <= 0 || (stop !== null && stop !== end))
      fail('unsupported legacy Euler clock');
    stop = end;
    const bindingIndex = bindings.length, offset = channels.length;
    bindings.push({path, typeID:4, attribute:4, rotationOrder:'ZXY', offset, size:3});
    for (const [component, axis] of ['x', 'y', 'z'].entries()) {
      channels.push({bindingIndex, component, kind:'legacy-euler', keys:keys.map((key, index) => {
        const d = key.value[axis], c = key.outSlope[axis], next = keys[index + 1];
        if (!next) return {time:key.time, coefficients:[0,0,0,d]};
        const dt = next.time - key.time, delta = next.value[axis] - d, endSlope = next.inSlope[axis];
        const a = ((c + endSlope) * dt - 2 * delta) / (dt * dt * dt);
        const b = (3 * delta - (2 * c + endSlope) * dt) / (dt * dt);
        return {time:key.time, coefficients:[a,b,c,d].map(v => finite(v, 'legacy coefficient'))};
      })});
    }
  }
  return {name:source.m_Name, format:'legacy-euler', start:0, stop, loop:true,
    bindings, channels, sourceFrames:0, streamedWords:0};
}

function effectClipTime(clip,time,loop=clip.loop){
  finite(time, 'sample time');
  if (typeof loop !== 'boolean') fail('invalid loop override');
  let t = Math.max(clip.start, time);
  if (loop && t >= clip.stop) t = clip.start + (t - clip.start) % (clip.stop - clip.start);
  else t = Math.min(t, clip.stop);
  return t;
}

// Local renderer policy only: float32 streamed coefficients can leave a tiny
// negative residue on a width segment whose authored endpoints are >=0 and 0.
// Keep the raw curve sample unchanged. Bound any zero snap by one float32
// relative epsilon times the absolute polynomial terms; never admit a negative
// authored endpoint, non-streamed curve, or larger negative excursion.
export function effectChannelZeroRoundoff(clip,channel,time){
  if(channel?.kind!=='streamed')return 0;
  const t=effectClipTime(clip,time),keys=channel.keys;
  let i=keys.length-1;while(i>=0&&keys[i].time>t)i--;
  if(i<0||i===keys.length-1||keys[i].coefficients[3]<0||keys[i+1].coefficients[3]!==0)return 0;
  const dt=t-keys[i].time,[a,b,c,d]=keys[i].coefficients;
  return 2**-23*(Math.abs(a*dt**3)+Math.abs(b*dt**2)+Math.abs(c*dt)+Math.abs(d));
}

export function sampleEffectClip(clip, time, {loop = clip.loop} = {}) {
  const t=effectClipTime(clip,time,loop);
  return clip.channels.map(channel => {
    if (channel.kind === 'constant') return channel.value;
    const keys = channel.keys;
    if (!keys.length || t < keys[0].time) return finite(channel.initialValue, 'initial channel value');
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
