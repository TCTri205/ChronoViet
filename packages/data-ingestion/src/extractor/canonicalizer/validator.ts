import {
  resolveCanonicalEntity,
  HistoricalRelationType,
  getCanonicalEntityIdPrefix,
  DEITY_TITLE_MAPPINGS,
  findHistoricalEpoch,
  HISTORICAL_PERSON_DICTIONARY,
} from '@chronoviet/shared-spec';
import { slugify } from '../../text/vietnamese-ner.js';
import { ExtractedTriple, VALID_RELATIONS } from '../types.js';
import {
  FOREIGN_DYNASTIES_SET,
  FOREIGN_COMMANDERS_SET,
  FOREIGN_INVADING_FORCES_SET,
  isForeignInvadingForce,
} from '../dictionaries/foreign-entities.js';
import { getSpatialHierarchyLevel } from '../helpers/spatial-level.js';

/**
 * Validate and enforce Canonical Directionality Matrix ($S \to R \to O$)
 */
export function validateAndCanonicalizeTriple(
  source: { id: string; name: string; type?: string },
  relation: HistoricalRelationType,
  target: { id: string; name: string; type?: string },
  confidence: number = 0.95,
  headingAnchorYear?: number
): ExtractedTriple | null {
  if (!source.id || !target.id || !relation || !VALID_RELATIONS.has(relation)) {
    return null;
  }

  let sId = source.id.toLowerCase();
  let sName = source.name;
  let tId = target.id.toLowerCase();
  let tName = target.name;
  let rel = relation;

  // Resolve Deity Titles (except when extracting ALIAS_OF or SAME_AS_LOCATION)
  if (rel !== 'ALIAS_OF' && rel !== 'SAME_AS_LOCATION') {
    const lowerS = sName.toLowerCase();
    if (DEITY_TITLE_MAPPINGS[lowerS]) {
      sId = DEITY_TITLE_MAPPINGS[lowerS].canonicalId;
      sName = DEITY_TITLE_MAPPINGS[lowerS].canonicalName;
    }
    const lowerT = tName.toLowerCase();
    if (DEITY_TITLE_MAPPINGS[lowerT]) {
      tId = DEITY_TITLE_MAPPINGS[lowerT].canonicalId;
      tName = DEITY_TITLE_MAPPINGS[lowerT].canonicalName;
    }
  }

  // Resolve raw numeric years or Can Chi to canonical dynasty/epoch
  if (/^\d{1,4}$/.test(tName) || /^\d{1,4}$/.test(tId.replace(/^[a-z]+_/, ''))) {
    const rawYr = tName.match(/\d{1,4}/)?.[0] || tId.match(/\d{1,4}/)?.[0];
    const yr = parseInt(rawYr || '0', 10);
    if (!isNaN(yr)) {
      const epoch = findHistoricalEpoch(yr);
      if (epoch) {
        tId = epoch.dynastyId;
      }
    }
  }

  // Master Canonical Entity ID Resolution (for all relations EXCEPT ALIAS_OF)
  if (rel !== 'ALIAS_OF') {
    // 1. Resolve Person to Master Canonical ID
    if (sId.startsWith('person_') || source.type === 'HISTORICAL_PERSON') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('person_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('person_') || target.type === 'HISTORICAL_PERSON') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('person_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 2. Resolve Dynasties / Eras
    if (sId.startsWith('dynasty_') || source.type === 'DYNASTY_ERA') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && (sCanon.entityId.startsWith('dynasty_') || sCanon.entityId.startsWith('epoch_'))) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('dynasty_') || target.type === 'DYNASTY_ERA') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && (tCanon.entityId.startsWith('dynasty_') || tCanon.entityId.startsWith('epoch_'))) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 3. Resolve Organizations
    if (sId.startsWith('org_') || source.type === 'ORGANIZATION') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
      if (sId === 'org_chua_trinh') {
        sId = 'dynasty_chua_trinh';
        sName = 'Chúa Trịnh';
      } else if (sId === 'org_chua_nguyen') {
        sId = 'dynasty_chua_nguyen';
        sName = 'Chúa Nguyễn';
      }
    }
    if (tId.startsWith('org_') || target.type === 'ORGANIZATION') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
      if (tId === 'org_chua_trinh') {
        tId = 'dynasty_chua_trinh';
        tName = 'Chúa Trịnh';
      } else if (tId === 'org_chua_nguyen') {
        tId = 'dynasty_chua_nguyen';
        tName = 'Chúa Nguyễn';
      }
    }

    // 4. Resolve Events
    if (sId.startsWith('event_') || source.type === 'EVENT_BATTLE') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('event_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('event_') || target.type === 'EVENT_BATTLE') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('event_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 5. Resolve Documents & Artifacts
    if (sId.startsWith('doc_') || source.type === 'DOCUMENT_CULTURE') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('doc_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('doc_') || target.type === 'DOCUMENT_CULTURE') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('doc_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }
    if (sId.startsWith('artifact_') || source.type === 'ARTIFACT') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('artifact_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('artifact_') || target.type === 'ARTIFACT') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('artifact_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 6. Resolve Locations
    if (sId.startsWith('loc_') || source.type === 'LOCATION') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('loc_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('loc_') || target.type === 'LOCATION') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('loc_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }
  }

  // Normalize Relation by Entity Target Ontology Type:
  if (rel === 'HAPPENED_IN' && tId.startsWith('loc_')) {
    rel = 'HAPPENED_AT';
  }
  if (rel === 'HAPPENED_AT' && (tId.startsWith('dynasty_') || tId.startsWith('epoch_'))) {
    rel = 'HAPPENED_IN';
  }
  if (rel === 'HAPPENED_IN' && sId.startsWith('person_') && tId.startsWith('dynasty_')) {
    rel = 'PART_OF';
  }
  if (rel === 'LED_BY' && sId.startsWith('dynasty_') && tId.startsWith('person_')) {
    rel = 'PART_OF';
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }
  if (rel === 'PART_OF' && (sId.startsWith('event_') || sId.startsWith('artifact_') || sId.startsWith('doc_')) && (tId.startsWith('dynasty_') || tId.startsWith('epoch_'))) {
    rel = 'HAPPENED_IN';
  }
  if (rel === 'PART_OF' && (sId.startsWith('person_') || sId.startsWith('org_') || sId.startsWith('loc_')) && tId.startsWith('loc_')) {
    rel = 'HAPPENED_AT';
  }
  if (rel === 'LED_BY' && sId.startsWith('person_') && tId.startsWith('loc_')) {
    rel = 'HAPPENED_AT';
  }
  if (rel === 'LED_BY' && sId.startsWith('loc_') && tId.startsWith('person_')) {
    rel = 'HAPPENED_AT';
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }
  if (rel === 'LED_BY' && sId.startsWith('person_') && tId.startsWith('doc_')) {
    rel = 'MENTIONED_IN';
  }
  if (rel === 'LED_BY' && sId.startsWith('doc_') && tId.startsWith('person_')) {
    rel = 'MENTIONED_IN';
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }
  if (rel === 'MENTIONED_IN' && sId.startsWith('doc_') && tId.startsWith('person_')) {
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }
  if (rel === 'MENTIONED_IN' && sId.startsWith('doc_') && (tId.startsWith('dynasty_') || tId.startsWith('epoch_'))) {
    rel = 'HAPPENED_IN';
  }
  if (rel === 'MENTIONED_IN' && (sId.startsWith('dynasty_') || sId.startsWith('epoch_')) && tId.startsWith('doc_')) {
    rel = 'HAPPENED_IN';
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }

  // 1. LED_BY: Event / Battle / Campaign / Organization -> Person / Organization
  if (rel === 'LED_BY') {
    if ((sId.startsWith('person_') || sId.startsWith('org_')) && tId.startsWith('event_')) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
    // Strict Guard: Source must be event or org
    if (!sId.startsWith('event_') && !sId.startsWith('org_')) {
      return null;
    }
    // Target can be person or organization (e.g. event led by org)
    if (!tId.startsWith('person_') && !tId.startsWith('org_')) {
      return null;
    }
  }

  // 2. HAPPENED_AT: Event / Di tích / Công trình / Cổ vật / Nhân vật / Địa danh cụ thể -> Location
  if (rel === 'HAPPENED_AT') {
    if (!tId.startsWith('loc_') && sId.startsWith('loc_')) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
    // Strict Guard: Target MUST be Location
    if (!tId.startsWith('loc_')) {
      return null;
    }
    // Source cannot be dynasty
    if (sId.startsWith('dynasty_')) {
      return null;
    }
    // Prefix-variant guard: two locations that differ only by prefix cannot have containment
    if (sId.startsWith('loc_') && tId.startsWith('loc_')) {
      const normS = sId.replace(/^loc_/, '').replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
      const normT = tId.replace(/^loc_/, '').replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
      if (normS === normT) {
        return null;
      }
      // Regional separation guard: A landmark located in Central/Southern Vietnam cannot HAPPENED_AT Thang Long / Hanoi
      const SITES_NOT_IN_THANG_LONG = new Set(['loc_nui_ban', 'loc_nui_nua', 'loc_nui_sam', 'loc_song_gianh', 'loc_song_tien', 'loc_song_hau', 'loc_ben_nha_rong', 'loc_dinh_doc_lap', 'loc_dien_bien_phu']);
      if ((tId === 'loc_thang_long' || tId === 'loc_ha_noi') && SITES_NOT_IN_THANG_LONG.has(sId)) {
        return null;
      }
    }
  }

  // 3. HAPPENED_IN: Event / Person / Artifact / Document -> Dynasty / Era
  if (rel === 'HAPPENED_IN') {
    if ((sId.startsWith('dynasty_') || sId.startsWith('epoch_')) && (tId.startsWith('event_') || tId.startsWith('person_') || tId.startsWith('artifact_') || tId.startsWith('doc_'))) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
    if (!tId.startsWith('dynasty_') && !tId.startsWith('epoch_')) {
      return null;
    }
    if (sId.startsWith('dynasty_') || sId.startsWith('epoch_') || sId.startsWith('loc_')) {
      return null;
    }
  }

  // 4. SAME_AS_LOCATION: Historical Location -> Modern Location
  if (rel === 'SAME_AS_LOCATION') {
    if (!sId.startsWith('loc_') || !tId.startsWith('loc_')) {
      return null;
    }
    // Self-loop or prefix-variant check:
    const normS = sId.replace(/^loc_/, '').replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
    const normT = tId.replace(/^loc_/, '').replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
    if (normS === normT) {
      return null;
    }
    // Rivers, mountains, gulfs cannot be SAME_AS_LOCATION
    if (
      sId.startsWith('loc_song_') || tId.startsWith('loc_song_') ||
      sId.startsWith('loc_nui_') || tId.startsWith('loc_nui_') ||
      sId.startsWith('loc_vinh_ha_long') || tId.startsWith('loc_vinh_ha_long')
    ) {
      return null;
    }
  }

  // 5. MENTIONED_IN: Entity (Person/Org/Dynasty) -> Document
  if (rel === 'MENTIONED_IN') {
    if (sId.startsWith('doc_') && !tId.startsWith('doc_')) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
    if (!tId.startsWith('doc_') || sId.startsWith('doc_')) {
      return null;
    }
    // Only persons, organizations, or dynasties can author or be mentioned in documents
    if (!sId.startsWith('person_') && !sId.startsWith('org_') && !sId.startsWith('dynasty_')) {
      return null;
    }
  }

  // 6. ROYAL_LINEAGE: Person -> Person (Younger successor -> Older predecessor)
  if (rel === 'ROYAL_LINEAGE') {
    if (!sId.startsWith('person_') || !tId.startsWith('person_')) {
      return null;
    }
    const sPerson = HISTORICAL_PERSON_DICTIONARY[sId];
    const tPerson = HISTORICAL_PERSON_DICTIONARY[tId];
    if (sPerson?.timeRange?.start && tPerson?.timeRange?.start) {
      const isBCE = sPerson.timeRange.start < 0 || tPerson.timeRange.start < 0;
      const yearDiff = Math.abs(sPerson.timeRange.start - tPerson.timeRange.start);
      // Royal succession or parent-child lineage cannot span > 120 years unless BCE mythical period
      if (!isBCE && yearDiff > 120) {
        return null;
      }
      if (sPerson.timeRange.start < tPerson.timeRange.start) {
        const tempId = sId;
        const tempName = sName;
        sId = tId;
        sName = tName;
        tId = tempId;
        tName = tempName;
      }
    }
  }

  // Strictly reject ungrounded/hallucinated entities or generic occupational pseudonyms
  const GENERIC_PSEUDO_PERSONS = new Set([
    'person_hoang_de',
    'person_vua',
    'person_nha_vua',
    'person_thai_tu',
    'person_quan_vuong',
    'person_tong_tu_lenh',
    'person_tu_lenh',
    'person_vi_tu_lenh',
    'person_chu_tich',
    'person_thu_tuong',
    'person_dai_tuong',
    'person_vi_danh_tuong',
    'person_nguoi_dung_dau',
    'person_nguoi_dung_dau_chinh_phu',
    'person_vi_thu_linh',
    'person_thu_linh_can_vuong',
    'person_vi_lanh_tu',
    'person_vi_anh_hung_ao_vai',
    'person_nguoi_anh_hung_ao_vai',
  ]);
  if (
    sId.startsWith('unknown_') ||
    tId.startsWith('unknown_') ||
    GENERIC_PSEUDO_PERSONS.has(sId) ||
    GENERIC_PSEUDO_PERSONS.has(tId)
  ) {
    return null;
  }

  // HAPPENED_IN: Vietnamese events, artifacts, documents cannot have HAPPENED_IN foreign invading dynasties
  if (rel === 'HAPPENED_IN') {
    if (FOREIGN_DYNASTIES_SET.has(tId) && !FOREIGN_INVADING_FORCES_SET.has(sId) && !isForeignInvadingForce(sId) && !FOREIGN_COMMANDERS_SET.has(sId)) {
      return null;
    }
  }

  // 7. PART_OF: Entity -> Dynasty / Org / State / Event
  if (rel === 'PART_OF') {
    if (tId.startsWith('doc_') || tId.startsWith('artifact_')) {
      return null;
    }
    const LITERARY_GROUPS = new Set(['org_ngo_gia_van_phai', 'org_tu_luc_van_doan']);
    if (LITERARY_GROUPS.has(tId) && (sId.includes('quang_trung') || sId.includes('nguyen_hue') || sId.includes('vua') || sId.includes('hoang_de') || sId.includes('chua'))) {
      return null;
    }
    const INTERNATIONAL_ORGS = new Set(['org_wto', 'org_asean', 'org_lhq', 'org_lien_hop_quoc']);
    if (sId.startsWith('dynasty_') && (tId.startsWith('doc_') || tId.startsWith('artifact_') || (tId.startsWith('org_') && !INTERNATIONAL_ORGS.has(tId)))) {
      return null;
    }
    if (sId.startsWith('dynasty_') && tId.startsWith('dynasty_')) {
      return null;
    }
    if (sId.startsWith('loc_') && (tId.startsWith('dynasty_') || tId.startsWith('epoch_') || tId.startsWith('loc_'))) {
      return null;
    }
    if (sId.startsWith('dynasty_') && tId.startsWith('loc_')) {
      return null;
    }
    if (sId.startsWith('person_') && tId.startsWith('person_')) {
      return null;
    }
    if (tId.startsWith('person_')) {
      return null;
    }
    if (sId.startsWith('person_') && tId.startsWith('loc_')) {
      return null;
    }
    // Prevent Vietnamese historical figures, events, artifacts from being labeled as PART_OF foreign invading dynasties or forces
    const isTargetForeign = FOREIGN_DYNASTIES_SET.has(tId) || FOREIGN_INVADING_FORCES_SET.has(tId) || isForeignInvadingForce(tId);
    const isSourceForeign = FOREIGN_COMMANDERS_SET.has(sId) || FOREIGN_INVADING_FORCES_SET.has(sId) || isForeignInvadingForce(sId);
    if (isTargetForeign && !isSourceForeign) {
      return null;
    }
    if (isSourceForeign && !isTargetForeign) {
      return null;
    }
  }

  // LED_BY: Foreign invading forces cannot be led by Vietnamese defending commanders, and Vietnamese events cannot be led by foreign commanders
  if (rel === 'LED_BY') {
    if (sId.startsWith('dynasty_') || tId.startsWith('dynasty_')) {
      return null;
    }
    const isSourceForeignForce = FOREIGN_INVADING_FORCES_SET.has(sId) || isForeignInvadingForce(sId);
    const isTargetForeignCommander = FOREIGN_COMMANDERS_SET.has(tId);
    if (isSourceForeignForce && !isTargetForeignCommander) {
      return null;
    }
    if (!isSourceForeignForce && isTargetForeignCommander) {
      return null;
    }
    if (sId.startsWith('person_') && (isSourceForeignForce || isForeignInvadingForce(tId) || FOREIGN_INVADING_FORCES_SET.has(tId) || FOREIGN_COMMANDERS_SET.has(tId))) {
      return null;
    }
  }

  // 8. ALIAS_OF & SAME_AS_LOCATION: Ensure source alias points to target canonical entity
  if (rel === 'ALIAS_OF' || rel === 'SAME_AS_LOCATION') {
    sName = source.name;
    tName = target.name;
    const prefix = getCanonicalEntityIdPrefix((source.type || target.type || (rel === 'SAME_AS_LOCATION' ? 'LOCATION' : 'HISTORICAL_PERSON')) as any);
    const sSlugId = source.id && !source.id.startsWith('unknown_') ? source.id : `${prefix}${slugify(sName)}`;
    const tSlugId = target.id && !target.id.startsWith('unknown_') ? target.id : `${prefix}${slugify(tName)}`;

    sId = sSlugId;
    tId = tSlugId;
  }

  // Type consistency guard for ALIAS_OF & SAME_AS_LOCATION
  if (rel === 'ALIAS_OF') {
    const isPerson = sId.startsWith('person_') && tId.startsWith('person_');
    const isLoc = sId.startsWith('loc_') && tId.startsWith('loc_');
    const isOrg = sId.startsWith('org_') && tId.startsWith('org_');
    if (!isPerson && !isLoc && !isOrg) {
      return null;
    }
    // ALIAS_OF Directional Convention: (Surface Alias -> Master Canonical ID)
    const origSName = sName;
    const origTName = tName;
    const sCanon = resolveCanonicalEntity(origSName) || resolveCanonicalEntity(sId);
    const tCanon = resolveCanonicalEntity(origTName) || resolveCanonicalEntity(tId);
    const master = tCanon?.entityId ? tCanon : (sCanon?.entityId ? sCanon : null);

    const typePrefix = isLoc ? 'loc_' : (isOrg ? 'org_' : 'person_');

    if (master) {
      let aliasName = origSName;
      if (slugify(origSName) === slugify(master.canonicalName) && slugify(origTName) !== slugify(master.canonicalName)) {
        aliasName = origTName;
      } else if (slugify(origTName) === slugify(master.canonicalName) && slugify(origSName) !== slugify(master.canonicalName)) {
        aliasName = origSName;
      } else {
        const sIsCanon = origSName.toLowerCase() === master.canonicalName.toLowerCase();
        const tIsCanon = origTName.toLowerCase() === master.canonicalName.toLowerCase();
        if (sIsCanon && !tIsCanon) {
          aliasName = origTName;
        } else if (tIsCanon && !sIsCanon) {
          aliasName = origSName;
        } else {
          aliasName = origSName !== master.canonicalName ? origSName : origTName;
        }
      }

      sId = `${typePrefix}${slugify(aliasName)}`;
      sName = aliasName;
      tId = master.entityId;
      tName = master.canonicalName;
    } else {
      if (sId === tId && origSName !== origTName) {
        sId = `${typePrefix}${slugify(origSName)}`;
        tId = `${typePrefix}${slugify(origTName)}`;
      }
    }

    if (sId === tId) {
      return null;
    }
  }
  if (rel === 'SAME_AS_LOCATION') {
    if (!sId.startsWith('loc_') || !tId.startsWith('loc_')) {
      return null;
    }
    // Check if mapping is a known historical location mapping (e.g. Thang Long <-> Ha Noi, Tay Do <-> Can Tho/Thanh Hoa, Phong Khe <-> Dong Anh)
    const isKnownLocationMapping = (s: string, t: string) => {
      const pair = `${s}::${t}`;
      const revPair = `${t}::${s}`;
      const ALLOWED_MAPPINGS = new Set([
        'loc_thang_long::loc_ha_noi', 'loc_ha_noi::loc_thang_long',
        'loc_dai_la::loc_ha_noi', 'loc_ha_noi::loc_dai_la',
        'loc_dong_kinh::loc_ha_noi', 'loc_ha_noi::loc_dong_kinh',
        'loc_dong_quan::loc_ha_noi', 'loc_ha_noi::loc_dong_quan',
        'loc_tong_binh::loc_ha_noi', 'loc_ha_noi::loc_tong_binh',
        'loc_tay_do::loc_can_tho', 'loc_can_tho::loc_tay_do',
        'loc_tay_do::loc_thanh_hoa', 'loc_thanh_hoa::loc_tay_do',
        'loc_phong_khe::loc_dong_anh', 'loc_dong_anh::loc_phong_khe',
        'loc_phong_khe::loc_ha_noi', 'loc_ha_noi::loc_phong_khe',
        'loc_ha_tay::loc_ha_noi', 'loc_ha_noi::loc_ha_tay',
        'loc_phu_xuan::loc_hue', 'loc_hue::loc_phu_xuan',
        'loc_thuan_hoa::loc_hue', 'loc_hue::loc_thuan_hoa',
        'loc_hoa_lu::loc_ninh_binh', 'loc_ninh_binh::loc_hoa_lu',
        'loc_sai_gon::loc_ho_chi_minh', 'loc_ho_chi_minh::loc_sai_gon',
        'loc_gia_dinh::loc_ho_chi_minh', 'loc_ho_chi_minh::loc_gia_dinh',
      ]);
      return ALLOWED_MAPPINGS.has(pair) || ALLOWED_MAPPINGS.has(revPair);
    };

    // Reject distinct historical capitals / separate major cities UNLESS they have historical correspondence
    const DISTINCT_CITIES = new Set(['loc_hoa_lu', 'loc_thang_long', 'loc_hue', 'loc_sai_gon', 'loc_da_nang', 'loc_ha_noi', 'loc_can_tho', 'loc_quy_nhon', 'loc_viet_tri']);
    if (DISTINCT_CITIES.has(sId) && DISTINCT_CITIES.has(tId) && sId !== tId && !isKnownLocationMapping(sId, tId)) {
      return null;
    }
    // Specific religious/smaller monuments located in a district/province must be HAPPENED_AT, not SAME_AS_LOCATION
    const MONUMENT_PREFIXES = ['loc_den_', 'loc_chua_', 'loc_lang_', 'loc_don_', 'loc_dinh_', 'loc_thuy_dien_', 'loc_ben_', 'loc_cau_', 'loc_nha_rong', 'loc_the_mieu'];
    if (MONUMENT_PREFIXES.some(p => sId.startsWith(p))) {
      rel = 'HAPPENED_AT';
    }
  }

  // 9. Spatial Hierarchy Directional Normalization (Child -> Parent in HAPPENED_AT)
  if (rel === 'HAPPENED_AT' && sId.startsWith('loc_') && tId.startsWith('loc_')) {
    const sLevel = getSpatialHierarchyLevel(sName, sId);
    const tLevel = getSpatialHierarchyLevel(tName, tId);
    // If source is at a strictly higher administrative/spatial level than target, normalize direction to Child -> Parent
    if (sLevel > tLevel) {
      const tempId = sId; sId = tId; tId = tempId;
      const tempName = sName; sName = tName; tName = tempName;
    }
  }

  // Self-loop prevention
  if (sId === tId) {
    return null;
  }

  return {
    sourceEntityId: sId,
    sourceEntityName: sName,
    relationType: rel,
    targetEntityId: tId,
    targetEntityName: tName,
    confidence: Number(confidence.toFixed(2)),
  };
}
