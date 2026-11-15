// SPDX-License-Identifier: GPL-3.0-or-later
// Shared validation for source registrations and their compiled runtime index.
export function assertSupportedOperator(op, support) {
  const skillIds = support?.skillIds ?? (support?.skillId == null ? [] : [support.skillId]);
  if (!support || !Array.isArray(op.skills) || op.skills.length !== skillIds.length
    || op.skills.some((skill, index) => skill.id !== skillIds[index]))
    throw new Error(`Unsupported regular-stage operator or skill: ${op?.id}`);
  for (const talent of op.talents ?? [])
    for (const candidate of talent.candidates)
      for (const { key } of candidate.blackboard ?? [])
        if (!support.talentKeys.includes(key))
          throw new Error(`Unsupported talent ${key}: ${op.id}`);
  return support;
}
