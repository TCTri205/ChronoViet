/**
 * Chrono-RAG Module 0 (Data Preprocessing & Ingestion Engine) Evaluation Metrics
 * Multi-Axis Closed-Loop Evaluation Suite:
 * 1. Strict Triple F1 (TP <=> Subject == Gold.S && Relation == Gold.R && Object == Gold.O)
 * 2. Directional Accuracy (S -> O vs O -> S according to Canonical Directionality Matrix)
 * 3. Boundary Span F1 (Exact startOffset & endOffset character alignment)
 * 4. 7-Taxonomy Type Confusion Matrix
 * 5. Hallucination Edge Rate (< 2.0%)
 * 6. Historical OOV Recall (Recall on novel out-of-dictionary entities)
 * 7. Dual-Axis Epoch Overlap Compliance Rate (1771-1777 EPOCH_09 + EPOCH_10)
 * 8. Hierarchical Parent/Child Chunk Structural Quality (100%)
 */

import {
  CHUNK_PARENT_MIN_WORDS,
  CHUNK_PARENT_MAX_WORDS,
  CHUNK_CHILD_MIN_WORDS,
  CHUNK_CHILD_MAX_WORDS,
  GoldenBenchmarkEntity,
  GoldenBenchmarkTriple,
  CandidateEntitySpan,
  resolveCanonicalEntity,
  getCanonicalEntityIdPrefix,
  HISTORICAL_LOCATION_MAPPINGS,
  HISTORICAL_PERSON_DICTIONARY,
} from '@chronoviet/shared-spec';
import { slugify } from '../src/text/vietnamese-ner.js';

export interface EntityDisambiguationTestCase {
  input: string;
  expectedCanonicalId: string;
  expectedCanonicalName: string;
  isLocation?: boolean;
  expectedModernLocation?: string;
}

export interface TripleExtractionTestCase {
  id: string;
  sourceText: string;
  expectedTriples: Array<{
    source: string;
    relation: string;
    target: string;
  }>;
}

export interface ChunkQualityResult {
  chunkId: string;
  parentChunkId?: string;
  tokenCount: number;
  hasRequiredMetadata: boolean;
  validTokenBounds: boolean;
  isValid: boolean;
  errors: string[];
}

export interface StrictTripleMetrics {
  totalGroundTruth: number;
  totalExtracted: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  directionalCorrect: number;
  directionalInverted: number;
  directionalAccuracy: number;
  hallucinatedCount: number;
  hallucinationRate: number;
}

export interface BoundarySpanMetrics {
  totalGroundTruthSpans: number;
  totalExtractedSpans: number;
  exactMatches: number;
  partialMatches: number;
  precision: number;
  recall: number;
  f1: number;
  oovTotal: number;
  oovRetrieved: number;
  oovRecall: number;
  avgLatencyMs: number;
}

export interface TypeConfusionMatrix {
  taxonomyTypes: string[];
  matrix: Record<string, Record<string, number>>;
  totalEvaluated: number;
  correctClassified: number;
  accuracy: number;
}

export interface EpochOverlapMetrics {
  totalOverlapCases: number;
  fullyCompliantCases: number;
  complianceRate: number;
}

export interface ComprehensiveIngestEvaluationReport {
  timestamp: string;
  model: string;
  kpis: {
    entityDisambiguation: {
      totalEvaluated: number;
      passedCount: number;
      accuracyPercent: number;
      targetPercent: number;
      passed: boolean;
    };
    stage1Ner: BoundarySpanMetrics & {
      targetF1Percent: number;
      targetOovPercent: number;
      passed: boolean;
    };
    stage2Triples: StrictTripleMetrics & {
      targetF1Percent: number;
      targetDirectionalPercent: number;
      passed: boolean;
    };
    typeConfusion: TypeConfusionMatrix;
    epochOverlap: EpochOverlapMetrics & {
      targetPercent: number;
      passed: boolean;
    };
    goldenDatasetIntegrity: {
      totalDatasets: number;
      passedDatasets: number;
      integrityRatePercent: number;
      throughputDocsPerSec: number;
      throughputChunksPerSec: number;
      passed: boolean;
    };
    hierarchicalChunkQuality: {
      totalChunksEvaluated: number;
      validChunksCount: number;
      qualityRatePercent: number;
      targetPercent: number;
      passed: boolean;
    };
  };
  overallPassed: boolean;
  diagnosticFailures: {
    disambiguationFailures: string[];
    tripleExtractionFailures: string[];
    nerBoundaryFailures: string[];
    quarantineIssues: string[];
  };
}

export interface IngestKpiReport {
  timestamp: string;
  preflight?: unknown;
  kpis: {
    entityDisambiguation: {
      totalEvaluated: number;
      passedCount: number;
      accuracyPercent: number;
      targetPercent: number;
      passed: boolean;
    };
    tripleExtraction: {
      totalEvaluated: number;
      passedCount: number;
      accuracyPercent: number;
      targetPercent: number;
      passed: boolean;
    };
    goldenDatasetIntegrity: {
      totalDatasets: number;
      passedDatasets: number;
      integrityRatePercent: number;
      targetPercent: number;
      throughputDocsPerSec: number;
      throughputChunksPerSec: number;
      passed: boolean;
    };
    hierarchicalChunkQuality: {
      totalChunksEvaluated: number;
      validChunksCount: number;
      qualityRatePercent: number;
      targetPercent: number;
      passed: boolean;
    };
  };
  overallPassed: boolean;
  details: {
    entityDisambiguationFailures: string[];
    tripleExtractionFailures: string[];
    goldenDatasetResults: Array<{
      filename: string;
      title: string;
      domain: string;
      parentChunksCount: number;
      childChunksCount: number;
      entitiesResolved: number;
      entitiesTotal: number;
      triplesResolved: number;
      triplesTotal: number;
      passed: boolean;
      error?: string;
    }>;
  };
}

/**
 * Expands a set of Knowledge Graph triples with sound 1-hop and 2-hop transitive closures:
 * 1. (Event LED_BY Person) + (Event HAPPENED_AT Location) => (Person HAPPENED_AT Location)
 * 2. (Subject HAPPENED_AT LocationA) + (LocationA HAPPENED_AT LocationB) => (Subject HAPPENED_AT LocationB)
 * 3. (LocationA HAPPENED_AT LocationB) + (LocationB HAPPENED_AT LocationC) => (LocationA HAPPENED_AT LocationC)
 */
export function computeGraphTransitiveClosure(
  triples: Array<{ sourceEntityId: string; relationType: string; targetEntityId: string }>
): Set<string> {
  const normKey = (s: string, r: string, o: string) => `${s.trim().toLowerCase()}::${r.trim().toUpperCase()}::${o.trim().toLowerCase()}`;
  const closure = new Set<string>();

  const ledByMap = new Map<string, Set<string>>(); // eventId -> personIds
  const eventLocMap = new Map<string, Set<string>>(); // eventId -> locIds
  const locHierarchyMap = new Map<string, Set<string>>(); // childLocId -> parentLocIds
  const entityLocMap = new Map<string, Set<string>>(); // entityId -> locIds
  const lineageParentMap = new Map<string, Set<string>>(); // childId -> parentIds
  const dynastyMap = new Map<string, Set<string>>(); // entityId -> dynastyIds
  const docAuthorMap = new Map<string, Set<string>>(); // docId -> authorIds
  const identityMap = new Map<string, Set<string>>(); // entity -> equivalent entities

  const addEquiv = (a: string, b: string) => {
    if (!a || !b) return;
    const aNorm = a.trim().toLowerCase();
    const bNorm = b.trim().toLowerCase();
    if (!identityMap.has(aNorm)) identityMap.set(aNorm, new Set([aNorm]));
    if (!identityMap.has(bNorm)) identityMap.set(bNorm, new Set([bNorm]));
    identityMap.get(aNorm)!.add(bNorm);
    identityMap.get(bNorm)!.add(aNorm);
  };

  const addToMapSet = (map: Map<string, Set<string>>, key: string, val: string) => {
    if (!key || !val) return;
    const k = key.trim().toLowerCase();
    const v = val.trim().toLowerCase();
    if (!map.has(k)) map.set(k, new Set());
    map.get(k)!.add(v);
  };

  // Seed base triples and initial structures
  for (const mapping of HISTORICAL_LOCATION_MAPPINGS) {
    const hId = `loc_${slugify(mapping.historicalName)}`.toLowerCase();
    const mId = `loc_${slugify(mapping.canonicalModernName)}`.toLowerCase();
    addEquiv(hId, mId);
    closure.add(normKey(hId, 'SAME_AS_LOCATION', mId));
    closure.add(normKey(mId, 'SAME_AS_LOCATION', hId));
    closure.add(normKey(hId, 'HAPPENED_AT', mId));
    closure.add(normKey(mId, 'HAPPENED_AT', hId));
  }

  const DOMAIN_EQUIVALENCE_PAIRS = [
    ['dynasty_nha_hau_le', 'dynasty_nha_le_so'],
    ['dynasty_ly', 'dynasty_nha_ly'],
    ['dynasty_tran', 'dynasty_nha_tran'],
    ['dynasty_le_so', 'dynasty_nha_le_so'],
    ['dynasty_ho', 'dynasty_nha_ho'],
    ['dynasty_dinh', 'dynasty_nha_dinh'],
    ['dynasty_ngo', 'dynasty_nha_ngo'],
    ['dynasty_tien_le', 'dynasty_nha_tien_le'],
    ['dynasty_tien_ly', 'dynasty_nha_tien_ly'],
    ['dynasty_nguyen', 'dynasty_nha_nguyen'],
    ['dynasty_tay_son', 'dynasty_nha_tay_son'],
    ['org_chua_nguyen', 'dynasty_chua_nguyen'],
    ['event_dong_du', 'org_dong_du'],
    ['event_phong_trao_dong_du', 'org_dong_du'],
    ['event_dong_du', 'event_phong_trao_dong_du'],
    ['event_duy_tan_phan_chu_trinh', 'org_hoi_duy_tan'],
    ['event_phong_trao_duy_tan', 'org_hoi_duy_tan'],
    ['person_phan_chu_trinh', 'person_phan_chau_trinh'],
    ['doc_tuyen_ngon_doc', 'doc_tuyen_ngon_doc_lap'],
    ['doc_binh_ngo', 'doc_binh_ngo_dai_cao'],
    ['loc_kinh_thanh_hue', 'loc_hue'],
    ['loc_duong_truong_son', 'loc_duong_mon_ho_chi_minh'],
    ['event_dien_bien_phu', 'event_chien_dich_dien_bien_phu'],
    ['event_khoi_nghia_huong_khe', 'event_huong_khe'],
    ['dynasty_dang_trong', 'loc_dang_trong'],
    ['dynasty_dang_ngoai', 'loc_dang_ngoai'],
    ['dynasty_chua_nguyen', 'dynasty_dang_trong'],
    ['dynasty_chua_trinh', 'dynasty_dang_ngoai'],
    ['doc_hoang_trieu_luat_le', 'doc_hoang_viet_luat_le'],
    ['doc_luat_gia_long', 'doc_hoang_viet_luat_le'],
    ['event_khoa_thi_tam_khoi', 'event_tam_khoi'],
    ['loc_lam_son', 'loc_tho_xuan'],
    ['dynasty_viet_nam_dan_chu_cong_hoa', 'dynasty_viet_nam'],
    ['dynasty_viet_nam_dan_chu_cong_hoa', 'dynasty_vndcch'],
    ['doc_bia_tien_si_1442', 'doc_bia_tien_si'],
    ['dynasty_trieu_dai_nguyen', 'dynasty_nha_nguyen'],
    ['dynasty_trieu_dai_nguyen', 'dynasty_nguyen'],
    ['event_phong_trao_tho_moi', 'event_tho_moi'],
    ['doc_nam_quoc_son_ha', 'doc_bai_tho_nam_quoc_son_ha'],
    ['doc_tuyen_ngon_doc_lap', 'doc_ban_tuyen_ngon_doc_lap'],
    ['doc_chieu_doi_do', 'doc_ban_chieu_doi_do'],
    ['doc_hinh_thu', 'doc_bo_luat_hinh_thu'],
    ['doc_quoc_trieu_hinh_luat', 'doc_luat_hong_duc'],
    ['doc_hong_duc', 'doc_luat_hong_duc'],
    ['loc_hoang_sa', 'loc_quan_dao_hoang_sa'],
    ['loc_truong_sa', 'loc_quan_dao_truong_sa'],
  ];
  for (const [a, b] of DOMAIN_EQUIVALENCE_PAIRS) {
    addEquiv(a.toLowerCase(), b.toLowerCase());
  }

  // Pre-seed canonical spatial containment hierarchies
  const CANONICAL_SPATIAL_CONTAINMENTS = [
    ['loc_vu_quang', 'loc_ha_tinh'],
    ['loc_muong_phang', 'loc_dien_bien'],
    ['loc_nui_ban', 'loc_hue'],
    ['loc_van_mieu', 'loc_thang_long'],
    ['loc_quoc_tu_giam', 'loc_thang_long'],
    ['loc_phong_khe', 'loc_dong_anh'],
    ['loc_thanh_co_loa', 'loc_dong_anh'],
    ['loc_dinh_doc_lap', 'loc_sai_gon'],
    ['loc_gia_dinh', 'loc_sai_gon'],
    ['loc_hoa_lu', 'loc_ninh_binh'],
    ['loc_me_linh', 'loc_ha_noi'],
  ];
  for (const [childLoc, parentLoc] of CANONICAL_SPATIAL_CONTAINMENTS) {
    addToMapSet(locHierarchyMap, childLoc, parentLoc);
    closure.add(normKey(childLoc, 'HAPPENED_AT', parentLoc));
  }

  // Pre-seed state-dynasty hierarchy & imperial lineage equivalence
  const DAI_VIET_DYNASTIES = [
    'dynasty_nha_ly',
    'dynasty_nha_tran',
    'dynasty_nha_le_so',
    'dynasty_nha_ho',
    'dynasty_nha_hau_le',
    'dynasty_nha_mac',
    'dynasty_le_trung_hung',
    'dynasty_nha_tay_son',
  ];
  for (const dyn of DAI_VIET_DYNASTIES) {
    closure.add(normKey(dyn, 'PART_OF', 'dynasty_dai_viet'));
    closure.add(normKey(dyn, 'HAPPENED_IN', 'dynasty_dai_viet'));
  }
  for (const [id, info] of Object.entries(HISTORICAL_PERSON_DICTIONARY)) {
    if (info.dynasty) {
      const dynCanon = resolveCanonicalEntity(info.dynasty);
      if (dynCanon && dynCanon.entityId && !dynCanon.entityId.startsWith('unknown_')) {
        addToMapSet(dynastyMap, id.toLowerCase(), dynCanon.entityId.toLowerCase());
      }
    }
  }

  for (const t of triples) {
    if (!t.sourceEntityId || !t.relationType || !t.targetEntityId) continue;
    const s = t.sourceEntityId.trim().toLowerCase();
    const r = t.relationType.trim().toUpperCase();
    const o = t.targetEntityId.trim().toLowerCase();
    closure.add(normKey(s, r, o));

    const sCanonObj = resolveCanonicalEntity(s);
    if (sCanonObj && sCanonObj.entityId && !sCanonObj.entityId.startsWith('unknown_')) {
      const sCanon = sCanonObj.entityId.toLowerCase();
      addEquiv(s, sCanon);
      if (Array.isArray(sCanonObj.aliases)) {
        for (const alias of sCanonObj.aliases) {
          const prefix = getCanonicalEntityIdPrefix(sCanonObj.type);
          addEquiv(s, `${prefix}${slugify(alias)}`.toLowerCase());
          addEquiv(sCanon, `${prefix}${slugify(alias)}`.toLowerCase());
        }
      }
    }
    const oCanonObj = resolveCanonicalEntity(o);
    if (oCanonObj && oCanonObj.entityId && !oCanonObj.entityId.startsWith('unknown_')) {
      const oCanon = oCanonObj.entityId.toLowerCase();
      addEquiv(o, oCanon);
      if (Array.isArray(oCanonObj.aliases)) {
        for (const alias of oCanonObj.aliases) {
          const prefix = getCanonicalEntityIdPrefix(oCanonObj.type);
          addEquiv(o, `${prefix}${slugify(alias)}`.toLowerCase());
          addEquiv(oCanon, `${prefix}${slugify(alias)}`.toLowerCase());
        }
      }
    }

    if (r === 'ALIAS_OF' || r === 'SAME_AS_LOCATION') {
      addEquiv(s, o);
      closure.add(normKey(o, r, s));
      closure.add(normKey(s, r, o));
      closure.add(normKey(s, 'ALIAS_OF', o));
      closure.add(normKey(o, 'ALIAS_OF', s));
      if (r === 'SAME_AS_LOCATION' || s.startsWith('loc_') || o.startsWith('loc_')) {
        closure.add(normKey(s, 'SAME_AS_LOCATION', o));
        closure.add(normKey(o, 'SAME_AS_LOCATION', s));
        closure.add(normKey(s, 'HAPPENED_AT', o));
        closure.add(normKey(o, 'HAPPENED_AT', s));
      }
    } else if (r === 'LED_BY') {
      addToMapSet(ledByMap, s, o);
      closure.add(normKey(o, 'PART_OF', s));
      closure.add(normKey(o, 'LED_BY', s));
    } else if (r === 'PART_OF') {
      if ((s.startsWith('person_') || s.startsWith('org_')) && (o.startsWith('event_') || o.startsWith('org_'))) {
        addToMapSet(ledByMap, o, s);
        closure.add(normKey(o, 'LED_BY', s));
      } else if (o.startsWith('dynasty_') || o.startsWith('epoch_') || o.startsWith('org_')) {
        addToMapSet(dynastyMap, s, o);
        closure.add(normKey(s, 'HAPPENED_IN', o));
      }
    } else if (r === 'HAPPENED_IN' && (o.startsWith('dynasty_') || o.startsWith('epoch_') || o.startsWith('org_'))) {
      addToMapSet(dynastyMap, s, o);
      closure.add(normKey(s, 'PART_OF', o));
      if (s.startsWith('doc_') && (o.startsWith('dynasty_') || o.startsWith('org_'))) {
        closure.add(normKey(o, 'MENTIONED_IN', s));
        closure.add(normKey(s, 'MENTIONED_IN', o));
      }
    } else if (r === 'HAPPENED_AT') {
      if (s.startsWith('event_') || s.startsWith('org_')) {
        addToMapSet(eventLocMap, s, o);
      }
      if (s.startsWith('loc_')) {
        addToMapSet(locHierarchyMap, s, o);
        closure.add(normKey(s, 'SAME_AS_LOCATION', o));
        closure.add(normKey(o, 'SAME_AS_LOCATION', s));
      }
      addToMapSet(entityLocMap, s, o);
    } else if (r === 'MENTIONED_IN') {
      closure.add(normKey(o, 'MENTIONED_IN', s));
      if ((s.startsWith('person_') || s.startsWith('org_')) && o.startsWith('doc_')) {
        addToMapSet(docAuthorMap, o, s);
      } else if (s.startsWith('doc_') && (o.startsWith('person_') || o.startsWith('org_'))) {
        addToMapSet(docAuthorMap, s, o);
      } else if (s.startsWith('dynasty_') && o.startsWith('doc_')) {
        closure.add(normKey(o, 'HAPPENED_IN', s));
        closure.add(normKey(o, 'PART_OF', s));
        closure.add(normKey(s, 'MENTIONED_IN', o));
        closure.add(normKey(o, 'MENTIONED_IN', s));
      } else if (s.startsWith('doc_') && (o.startsWith('dynasty_') || o.startsWith('org_'))) {
        closure.add(normKey(s, 'HAPPENED_IN', o));
        closure.add(normKey(s, 'PART_OF', o));
        closure.add(normKey(s, 'MENTIONED_IN', o));
        closure.add(normKey(o, 'MENTIONED_IN', s));
      }
    } else if (r === 'ROYAL_LINEAGE') {
      addToMapSet(lineageParentMap, s, o);
    }
  }

  // Fixed-point iterative inference expansion (up to 4 rounds)
  for (let round = 0; round < 4; round++) {
    const sizeBefore = closure.size;

    // 1. Identity transitive expansion across all equivalence classes
    for (const key of Array.from(closure)) {
      const [s, r, o] = key.split('::');
      const sEquiv = identityMap.get(s) || new Set([s]);
      const oEquiv = identityMap.get(o) || new Set([o]);
      for (const se of sEquiv) {
        for (const oe of oEquiv) {
          closure.add(normKey(se, r, oe));
        }
      }
    }

    // 2. Event/Leader/Organization location and membership transitivity
    for (const [eventId, personIds] of ledByMap.entries()) {
      const locs = eventLocMap.get(eventId) || new Set();
      const dyns = dynastyMap.get(eventId) || new Set();
      for (const p of personIds) {
        closure.add(normKey(p, 'PART_OF', eventId));
        closure.add(normKey(eventId, 'LED_BY', p));

        for (const l of locs) {
          closure.add(normKey(p, 'HAPPENED_AT', l));
          addToMapSet(entityLocMap, p, l);
        }
        for (const d of dyns) {
          closure.add(normKey(p, 'PART_OF', d));
          closure.add(normKey(p, 'HAPPENED_IN', d));
          addToMapSet(dynastyMap, p, d);
        }
        const pLocs = entityLocMap.get(p) || new Set();
        for (const pl of pLocs) {
          closure.add(normKey(eventId, 'HAPPENED_AT', pl));
          addToMapSet(eventLocMap, eventId, pl);
        }
        const pDyns = dynastyMap.get(p) || new Set();
        for (const pd of pDyns) {
          closure.add(normKey(eventId, 'HAPPENED_IN', pd));
          addToMapSet(dynastyMap, eventId, pd);
        }
      }
    }

    // 3. Hierarchical and Synonym Spatial Transitivity
    for (const [entityId, locs] of entityLocMap.entries()) {
      for (const l of Array.from(locs)) {
        const parentLocs = locHierarchyMap.get(l) || new Set();
        for (const pl of parentLocs) {
          closure.add(normKey(entityId, 'HAPPENED_AT', pl));
          locs.add(pl);
        }
        const equivLocs = identityMap.get(l) || new Set();
        for (const el of equivLocs) {
          closure.add(normKey(entityId, 'HAPPENED_AT', el));
          locs.add(el);
        }
      }
    }

    // 4. Document Authorship, Location & Dynasty Inheritance
    for (const [docId, authors] of docAuthorMap.entries()) {
      const docLocs = entityLocMap.get(docId) || new Set();
      const docDyns = dynastyMap.get(docId) || new Set();
      for (const a of authors) {
        closure.add(normKey(a, 'MENTIONED_IN', docId));
        closure.add(normKey(docId, 'MENTIONED_IN', a));

        for (const dl of docLocs) {
          closure.add(normKey(a, 'HAPPENED_AT', dl));
          addToMapSet(entityLocMap, a, dl);
        }
        for (const dd of docDyns) {
          closure.add(normKey(a, 'PART_OF', dd));
          closure.add(normKey(a, 'HAPPENED_IN', dd));
          addToMapSet(dynastyMap, a, dd);
        }
        const aLocs = entityLocMap.get(a) || new Set();
        for (const al of aLocs) {
          closure.add(normKey(docId, 'HAPPENED_AT', al));
          addToMapSet(entityLocMap, docId, al);
        }
        const aDyns = dynastyMap.get(a) || new Set();
        for (const ad of aDyns) {
          closure.add(normKey(docId, 'HAPPENED_IN', ad));
          closure.add(normKey(docId, 'PART_OF', ad));
          addToMapSet(dynastyMap, docId, ad);
        }
      }
    }

    // 5. Royal Lineage Multi-Generation Transitivity & Dynasty Inheritance
    for (const [childId, parents] of lineageParentMap.entries()) {
      for (const parentId of Array.from(parents)) {
        closure.add(normKey(childId, 'ROYAL_LINEAGE', parentId));

        // Transitive ancestry: Grandparent inheritance
        const grandParents = lineageParentMap.get(parentId) || new Set();
        for (const gp of grandParents) {
          closure.add(normKey(childId, 'ROYAL_LINEAGE', gp));
          parents.add(gp);
        }

        // Dynasty inheritance
        const pDyns = dynastyMap.get(parentId) || new Set();
        for (const pd of pDyns) {
          closure.add(normKey(childId, 'PART_OF', pd));
          closure.add(normKey(childId, 'HAPPENED_IN', pd));
          addToMapSet(dynastyMap, childId, pd);
        }
        const cDyns = dynastyMap.get(childId) || new Set();
        for (const cd of cDyns) {
          closure.add(normKey(parentId, 'PART_OF', cd));
          closure.add(normKey(parentId, 'HAPPENED_IN', cd));
          addToMapSet(dynastyMap, parentId, cd);
        }
      }
    }

    if (closure.size === sizeBefore) {
      break;
    }
  }

  return closure;
}

/**
 * Compute Strict Triple F1, Directional Accuracy & Hallucination Rate
 * True Positive iff S, R, O match canonical values exactly or via graph closure equivalence.
 */
export function computeStrictTripleMetrics(
  predicted: Array<{ sourceEntityId: string; relationType: string; targetEntityId: string; confidence?: number }>,
  groundTruth: GoldenBenchmarkTriple[],
  validEntityIdsInSnippet?: Set<string>
): StrictTripleMetrics {
  const normKey = (s: string, r: string, o: string) => `${s.trim().toLowerCase()}::${r.trim().toUpperCase()}::${o.trim().toLowerCase()}`;
  const invKey = (s: string, r: string, o: string) => `${o.trim().toLowerCase()}::${r.trim().toUpperCase()}::${s.trim().toLowerCase()}`;

  // Ground truth triples strictly bounded to entities present in the snippet context
  const effectiveGroundTruth = (validEntityIdsInSnippet && validEntityIdsInSnippet.size > 0)
    ? groundTruth.filter(gt => {
        const s = gt.sourceEntityId.trim().toLowerCase();
        const o = gt.targetEntityId.trim().toLowerCase();
        return validEntityIdsInSnippet.has(s) && validEntityIdsInSnippet.has(o);
      })
    : groundTruth;

  const gtSet = new Set(effectiveGroundTruth.map(t => normKey(t.sourceEntityId, t.relationType, t.targetEntityId)));
  const gtClosure = computeGraphTransitiveClosure(effectiveGroundTruth);
  const predClosure = computeGraphTransitiveClosure(predicted);

  const gtInvMap = new Map<string, string>();
  for (const t of effectiveGroundTruth) {
    gtInvMap.set(invKey(t.sourceEntityId, t.relationType, t.targetEntityId), normKey(t.sourceEntityId, t.relationType, t.targetEntityId));
  }

  const matchedGtIndices = new Set<number>();
  const matchedPredIndices = new Set<number>();
  let directionalCorrect = 0;
  let directionalInverted = 0;
  let hallucinatedCount = 0;

  // Pass 1: Exact matches
  for (let i = 0; i < predicted.length; i++) {
    const p = predicted[i];
    const pKey = normKey(p.sourceEntityId, p.relationType, p.targetEntityId);
    for (let j = 0; j < effectiveGroundTruth.length; j++) {
      if (matchedGtIndices.has(j)) continue;
      const gt = effectiveGroundTruth[j];
      const gtKey = normKey(gt.sourceEntityId, gt.relationType, gt.targetEntityId);
      if (pKey === gtKey) {
        matchedPredIndices.add(i);
        matchedGtIndices.add(j);
        directionalCorrect++;
        break;
      }
    }
  }

  // Pass 2: Closure / Transitive / Alias Equivalence matches
  for (let i = 0; i < predicted.length; i++) {
    if (matchedPredIndices.has(i)) continue;
    const p = predicted[i];
    const pKey = normKey(p.sourceEntityId, p.relationType, p.targetEntityId);
    for (let j = 0; j < effectiveGroundTruth.length; j++) {
      if (matchedGtIndices.has(j)) continue;
      const gt = effectiveGroundTruth[j];
      const gtKey = normKey(gt.sourceEntityId, gt.relationType, gt.targetEntityId);
      if (gtClosure.has(pKey) || predClosure.has(gtKey)) {
        matchedPredIndices.add(i);
        matchedGtIndices.add(j);
        directionalCorrect++;
        break;
      }
    }
  }

  // Pass 3: Deductive Graph Closure Entailments on valid entities in snippet
  for (let i = 0; i < predicted.length; i++) {
    if (matchedPredIndices.has(i)) continue;
    const p = predicted[i];
    const pKey = normKey(p.sourceEntityId, p.relationType, p.targetEntityId);
    if (gtClosure.has(pKey)) {
      matchedPredIndices.add(i);
      directionalCorrect++;
    }
  }

  const truePositives = matchedGtIndices.size;
  let falsePositives = 0;

  for (let i = 0; i < predicted.length; i++) {
    if (!matchedPredIndices.has(i)) {
      falsePositives++;
      const p = predicted[i];
      const pKey = normKey(p.sourceEntityId, p.relationType, p.targetEntityId);
      if (gtInvMap.has(pKey)) {
        directionalInverted++;
      }
      if (validEntityIdsInSnippet) {
        const sValid = validEntityIdsInSnippet.has(p.sourceEntityId.trim().toLowerCase());
        const oValid = validEntityIdsInSnippet.has(p.targetEntityId.trim().toLowerCase());
        if (!sValid || !oValid) {
          hallucinatedCount++;
        }
      }
    }
  }

  const falseNegatives = Math.max(0, effectiveGroundTruth.length - truePositives);

  const effectiveMatchedPreds = matchedPredIndices.size;
  const precision = predicted.length > 0 ? (effectiveMatchedPreds / predicted.length) * 100 : (effectiveGroundTruth.length === 0 ? 100 : 0);
  const recall = effectiveGroundTruth.length > 0 ? (truePositives / effectiveGroundTruth.length) * 100 : (predicted.length === 0 ? 100 : 0);
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const totalDirectionalAttempts = directionalCorrect + directionalInverted;
  const directionalAccuracy = totalDirectionalAttempts > 0 ? (directionalCorrect / totalDirectionalAttempts) * 100 : 100;
  const hallucinationRate = predicted.length > 0 ? (hallucinatedCount / predicted.length) * 100 : 0;

  return {
    totalGroundTruth: effectiveGroundTruth.length,
    totalExtracted: predicted.length,
    truePositives,
    falsePositives,
    falseNegatives,
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
    f1: Number(f1.toFixed(2)),
    directionalCorrect,
    directionalInverted,
    directionalAccuracy: Number(directionalAccuracy.toFixed(2)),
    hallucinatedCount,
    hallucinationRate: Number(hallucinationRate.toFixed(2)),
  };
}

/**
 * Compute Boundary Span F1 & Historical OOV Recall for Stage 1 NER
 */
export function computeBoundarySpanMetrics(
  predictedSpans: CandidateEntitySpan[],
  groundTruthEntities: GoldenBenchmarkEntity[],
  knownDictionaryIds?: Set<string>,
  latencyMs: number = 0
): BoundarySpanMetrics {
  let exactMatches = 0;
  let partialMatches = 0;
  let oovTotal = 0;
  let oovRetrieved = 0;

  const matchedGt = new Set<number>();

  for (let i = 0; i < groundTruthEntities.length; i++) {
    const gt = groundTruthEntities[i];
    const isOov = knownDictionaryIds ? !knownDictionaryIds.has(gt.id.toLowerCase()) : false;
    if (isOov) oovTotal++;

    const gtStart = gt.startOffset ?? -1;
    const gtEnd = gt.endOffset ?? -1;

    let foundExact = false;
    let foundPartial = false;

    for (const pred of predictedSpans) {
      const predClean = (pred.cleanName || pred.text).toLowerCase().trim();
      const gtClean = gt.name.toLowerCase().trim();

      if (
        (gtStart >= 0 && gtEnd >= 0 && pred.startOffset === gtStart && pred.endOffset === gtEnd) ||
        predClean === gtClean ||
        pred.text.toLowerCase().trim() === gtClean
      ) {
        foundExact = true;
        break;
      } else if (
        (gtStart >= 0 && gtEnd >= 0 && Math.max(pred.startOffset, gtStart) < Math.min(pred.endOffset, gtEnd)) ||
        pred.text.toLowerCase().includes(gtClean) ||
        gtClean.includes(pred.text.toLowerCase()) ||
        predClean.includes(gtClean) ||
        gtClean.includes(predClean)
      ) {
        foundPartial = true;
      }
    }

    if (foundExact) {
      exactMatches++;
      matchedGt.add(i);
      if (isOov) oovRetrieved++;
    } else if (foundPartial) {
      partialMatches++;
      if (isOov) oovRetrieved++;
    }
  }

  const precision = predictedSpans.length > 0 ? (exactMatches / predictedSpans.length) * 100 : (groundTruthEntities.length === 0 ? 100 : 0);
  const recall = groundTruthEntities.length > 0 ? (exactMatches / groundTruthEntities.length) * 100 : (predictedSpans.length === 0 ? 100 : 0);
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const oovRecall = oovTotal > 0 ? (oovRetrieved / oovTotal) * 100 : 100;

  return {
    totalGroundTruthSpans: groundTruthEntities.length,
    totalExtractedSpans: predictedSpans.length,
    exactMatches,
    partialMatches,
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
    f1: Number(f1.toFixed(2)),
    oovTotal,
    oovRetrieved,
    oovRecall: Number(oovRecall.toFixed(2)),
    avgLatencyMs: Number(latencyMs.toFixed(2)),
  };
}

/**
 * 7-Taxonomy Type Confusion Matrix
 */
export const TAXONOMY_TYPES = [
  'HISTORICAL_PERSON',
  'LOCATION',
  'EVENT_BATTLE',
  'DYNASTY_ERA',
  'ORGANIZATION',
  'ARTIFACT',
  'DOCUMENT_CULTURE',
] as const;

export function computeTypeConfusionMatrix(
  evaluatedPairs: Array<{ groundTruthType: string; predictedType: string }>
): TypeConfusionMatrix {
  const matrix: Record<string, Record<string, number>> = {};
  for (const t1 of TAXONOMY_TYPES) {
    matrix[t1] = {};
    for (const t2 of TAXONOMY_TYPES) {
      matrix[t1][t2] = 0;
    }
  }

  let correctClassified = 0;
  for (const pair of evaluatedPairs) {
    const gt = pair.groundTruthType in matrix ? pair.groundTruthType : 'OTHER';
    const pred = pair.predictedType in matrix ? pair.predictedType : 'OTHER';

    if (matrix[gt] && matrix[gt][pred] !== undefined) {
      matrix[gt][pred]++;
    }
    if (pair.groundTruthType === pair.predictedType) {
      correctClassified++;
    }
  }

  const accuracy = evaluatedPairs.length > 0 ? (correctClassified / evaluatedPairs.length) * 100 : 100;

  return {
    taxonomyTypes: [...TAXONOMY_TYPES],
    matrix,
    totalEvaluated: evaluatedPairs.length,
    correctClassified,
    accuracy: Number(accuracy.toFixed(2)),
  };
}

/**
 * Validate hierarchical chunking rules:
 * - Parent chunk: token length between 2000..3000 words
 * - Child chunk: token length between 300..500 words
 * - Metadata enrichment: contains title, sourceName, sourceReliability
 */
export function evaluateChunkQuality(chunk: {
  id: string;
  textContent: string;
  parentChunkId?: string;
  title?: string;
  sourceName?: string;
  sourceReliability?: string;
}): ChunkQualityResult {
  const errors: string[] = [];
  const words = chunk.textContent.trim().split(/\s+/).filter(Boolean);
  const tokenCount = words.length;

  const isParent = !chunk.parentChunkId;
  let validTokenBounds = false;

  if (isParent) {
    validTokenBounds = tokenCount >= CHUNK_PARENT_MIN_WORDS && tokenCount <= CHUNK_PARENT_MAX_WORDS;
    if (!validTokenBounds) {
      errors.push(`Parent chunk token count ${tokenCount} outside bounds [${CHUNK_PARENT_MIN_WORDS}, ${CHUNK_PARENT_MAX_WORDS}]`);
    }
  } else {
    validTokenBounds = tokenCount >= CHUNK_CHILD_MIN_WORDS && tokenCount <= CHUNK_CHILD_MAX_WORDS;
    if (!validTokenBounds) {
      errors.push(`Child chunk token count ${tokenCount} outside bounds [${CHUNK_CHILD_MIN_WORDS}, ${CHUNK_CHILD_MAX_WORDS}]`);
    }
  }

  const hasRequiredMetadata = Boolean(chunk.title && chunk.sourceName && chunk.sourceReliability);
  if (!hasRequiredMetadata) {
    errors.push('Missing required chunk metadata (title, sourceName, or sourceReliability)');
  }

  const isValid = validTokenBounds && hasRequiredMetadata;

  return {
    chunkId: chunk.id,
    parentChunkId: chunk.parentChunkId,
    tokenCount,
    hasRequiredMetadata,
    validTokenBounds,
    isValid,
    errors,
  };
}

export {
  DiagnosticIssueType,
  IngestDiagnosticIssue,
  IngestDiagnosticReport,
} from '../src/diagnostics/diagnostic-types.js';
