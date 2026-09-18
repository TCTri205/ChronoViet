/**
 * Administrative Containment & Geographic Hallucination Validator
 */
import type { AdministrativeHierarchy, AdministrativeContainmentResult } from './types.js';
import {
  ADMINISTRATIVE_HIERARCHY_DICTIONARY,
  lookupAdministrativeHierarchy,
  normalizePlaceName,
} from './admin-hierarchy.js';


/**
 * Validates geographical containment and detects historical/administrative mismatches.
 * Fast deterministic lookup (<= 1ms) to prevent geographic hallucinations.
 */
export function validateAdministrativeContainment(
  arg1: { placeName: string; claimedParent: string } | string,
  arg2?: string
): AdministrativeContainmentResult {
  if (typeof arg1 === 'object' && arg1 !== null) {
    return checkPairContainment(arg1.placeName, arg1.claimedParent);
  }

  if (typeof arg1 === 'string' && typeof arg2 === 'string') {
    return checkPairContainment(arg1, arg2);
  }

  if (typeof arg1 === 'string' && !arg2) {
    return checkTextContainment(arg1);
  }

  return { valid: true };
}

function checkPairContainment(childName: string, claimedParent: string): AdministrativeContainmentResult {
  const childInfo = lookupAdministrativeHierarchy(childName);
  const parentInfo = lookupAdministrativeHierarchy(claimedParent);

  if (!childInfo) {
    return { valid: true, childName, claimedParentName: claimedParent };
  }

  // If child has no higher parents defined (e.g. it is already a top province)
  if (!childInfo.parentNames && !childInfo.modernProvince) {
    return { valid: true, childName: childInfo.canonicalName, claimedParentName: claimedParent };
  }

  const validParentNorms = new Set<string>();
  if (childInfo.modernProvince) {
    validParentNorms.add(childInfo.modernProvince.toLowerCase().normalize('NFC'));
    validParentNorms.add(normalizePlaceName(childInfo.modernProvince));
  }
  if (childInfo.parentNames) {
    for (const p of childInfo.parentNames) {
      validParentNorms.add(p.toLowerCase().normalize('NFC'));
      validParentNorms.add(normalizePlaceName(p));
      const pInfo = lookupAdministrativeHierarchy(p);
      if (pInfo?.modernProvince) {
        validParentNorms.add(pInfo.modernProvince.toLowerCase().normalize('NFC'));
        validParentNorms.add(normalizePlaceName(pInfo.modernProvince));
      }
    }
  }

  const claimedNorm = claimedParent.toLowerCase().normalize('NFC');
  const claimedStripped = normalizePlaceName(claimedParent);

  // If claimed parent is in the valid hierarchy
  if (validParentNorms.has(claimedNorm) || validParentNorms.has(claimedStripped)) {
    return {
      valid: true,
      childName: childInfo.canonicalName,
      claimedParentName: claimedParent,
      actualProvince: childInfo.modernProvince,
      actualParents: childInfo.parentNames,
    };
  }

  // If claimed parent is a recognized distinct province/district but NOT a valid parent for this child
  if (parentInfo && (parentInfo.unitType === 'PROVINCE' || parentInfo.unitType === 'DISTRICT')) {
    const parentProv = parentInfo.modernProvince || parentInfo.canonicalName;
    const childProv = childInfo.modernProvince || childInfo.parentNames?.[0] || 'địa phương khác';
    if (parentProv.toLowerCase() !== childProv.toLowerCase()) {
      return {
        valid: false,
        childName: childInfo.canonicalName,
        claimedParentName: parentInfo.canonicalName,
        actualProvince: childInfo.modernProvince,
        actualParents: childInfo.parentNames,
        reason: `${childInfo.canonicalName} thuộc ${childProv}, không thuộc ${parentInfo.canonicalName}.`,
        suggestedCorrection: childInfo.modernProvince || childInfo.canonicalName,
      };
    }
  }

  return {
    valid: true,
    childName: childInfo.canonicalName,
    claimedParentName: claimedParent,
    actualProvince: childInfo.modernProvince,
  };
}

function checkTextContainment(text: string): AdministrativeContainmentResult {
  if (!text || typeof text !== 'string') return { valid: true };

  // Look for known pairs or co-occurrences in the text using unicode-safe word boundary
  const foundEntities: { raw: string; info: AdministrativeHierarchy; index: number }[] = [];

  for (const [key, info] of Object.entries(ADMINISTRATIVE_HIERARCHY_DICTIONARY)) {
    const candidates = [info.canonicalName, ...(info.aliases || [])];
    for (const c of candidates) {
      if (c.length < 3) continue; // Skip very short aliases
      const escaped = c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ])(${escaped})($|[^a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ])`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const matchedWord = match[2];
        const matchIndex = match.index + match[1].length;
        foundEntities.push({
          raw: matchedWord,
          info,
          index: matchIndex,
        });
      }
    }
  }

  if (foundEntities.length < 2) {
    return { valid: true };
  }

  // Sort by index in text
  foundEntities.sort((a, b) => a.index - b.index);

  // Check proximate entities (within 120 chars)
  for (let i = 0; i < foundEntities.length; i++) {
    for (let j = i + 1; j < foundEntities.length; j++) {
      const e1 = foundEntities[i];
      const e2 = foundEntities[j];
      if (Math.abs(e2.index - e1.index) > 150) continue;

      // If e1 is a child (e.g. Hoa Lư) and e2 is a province (e.g. Nghệ An)
      if (e1.info.unitType !== 'PROVINCE' && (e2.info.unitType === 'PROVINCE' || e2.info.unitType === 'DISTRICT')) {
        const pairRes = checkPairContainment(e1.info.canonicalName, e2.info.canonicalName);
        if (!pairRes.valid) return pairRes;
      }

      // If e2 is a child and e1 is a province/district
      if (e2.info.unitType !== 'PROVINCE' && (e1.info.unitType === 'PROVINCE' || e1.info.unitType === 'DISTRICT')) {
        const pairRes = checkPairContainment(e2.info.canonicalName, e1.info.canonicalName);
        if (!pairRes.valid) return pairRes;
      }
    }
  }

  return { valid: true };
}

