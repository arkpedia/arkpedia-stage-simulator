// SPDX-License-Identifier: GPL-3.0-or-later
// 0-1's official Android ETC2 RGBA bake uses Unity's RGBM range of 5.
// SRGB texture sampling already linearizes RGB; alpha retains the multiplier.
export function rgbmLightmapChunk(chunk) {
  const sample = "vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;";
  if (!chunk.includes(sample)) throw Error("Unsupported lightmap shader");
  return chunk.replace(
    sample,
    "vec3 lightMapIrradiance = lightMapTexel.rgb * (34.493242 * pow(lightMapTexel.a, 2.2)) * lightMapIntensity;",
  );
}
