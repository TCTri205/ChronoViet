/**
 * Pacing, Duration Budgeting & Synthetic Reconciliation Mathematical Metrics
 * Multi-Agent Orchestrator Evaluation Framework (ChronoAgent-Eval v2.0)
 */

export interface ChapterBudgetAnalysis {
  chapterIndex: number;
  chapterTitle: string;
  targetDurationSeconds: number;
  allocatedDurationSeconds: number;
  errorPercentage: number;
  isWithinTolerance: boolean;
}

export interface ScriptPacingEvaluationResult {
  targetTotalDurationSeconds: number;
  plannedTotalDurationSeconds: number;
  totalPacingErrorPercentage: number;
  averageChapterErrorPercentage: number;
  maxChapterErrorPercentage: number;
  chapterAnalyses: ChapterBudgetAnalysis[];
  isPassingPacingKpi: boolean; // < 5.0%
}

export interface SceneDurationComplianceResult {
  totalScenes: number;
  compliantScenes: number;
  nonCompliantScenes: number;
  complianceRatePercentage: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  avgDurationSeconds: number;
  violatingSceneIds: string[];
  isPassingGranularityKpi: boolean; // >= 95.0%
}

export interface SyntheticReconciliationAnalysis {
  originalTargetDurationSeconds: number;
  driftedAudioDurationSeconds: number;
  reconciledDurationSeconds: number;
  appliedDriftPercentage: number;
  reconciliationErrorPercentage: number;
  isFullyReconciled: boolean;
}

export interface HistoricalToneEvaluationResult {
  toneScorePercentage: number;
  solemnityScore: number;
  slangPenalty: number;
  entityCoveragePercentage: number;
  detectedSlangTerms: string[];
  missingEntities: string[];
  isPassingTone: boolean;
  isPassingEntityContinuity: boolean;
}

/**
 * 1. Calculate Chapter & Total Duration Budgeting Error
 */
export function calculateBudgetPacingMetrics(
  targetTotalSeconds: number,
  chapters: Array<{
    index?: number;
    title?: string;
    targetSeconds: number;
    plannedSeconds: number;
  }>,
  tolerancePercentage: number = 5.0
): ScriptPacingEvaluationResult {
  if (!chapters || chapters.length === 0) {
    return {
      targetTotalDurationSeconds: targetTotalSeconds,
      plannedTotalDurationSeconds: 0,
      totalPacingErrorPercentage: 100,
      averageChapterErrorPercentage: 100,
      maxChapterErrorPercentage: 100,
      chapterAnalyses: [],
      isPassingPacingKpi: false,
    };
  }

  let sumPlannedSeconds = 0;
  let sumChapterErrors = 0;
  let maxChapterError = 0;
  const chapterAnalyses: ChapterBudgetAnalysis[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    sumPlannedSeconds += ch.plannedSeconds;

    const error =
      ch.targetSeconds > 0
        ? (Math.abs(ch.plannedSeconds - ch.targetSeconds) / ch.targetSeconds) * 100
        : 0;

    if (error > maxChapterError) {
      maxChapterError = error;
    }
    sumChapterErrors += error;

    chapterAnalyses.push({
      chapterIndex: ch.index ?? i,
      chapterTitle: ch.title ?? `Chapter ${i + 1}`,
      targetDurationSeconds: ch.targetSeconds,
      allocatedDurationSeconds: ch.plannedSeconds,
      errorPercentage: Number(error.toFixed(2)),
      isWithinTolerance: error <= tolerancePercentage,
    });
  }

  const totalPacingError =
    targetTotalSeconds > 0
      ? (Math.abs(sumPlannedSeconds - targetTotalSeconds) / targetTotalSeconds) * 100
      : 0;

  const avgChapterError = sumChapterErrors / chapters.length;

  return {
    targetTotalDurationSeconds: targetTotalSeconds,
    plannedTotalDurationSeconds: sumPlannedSeconds,
    totalPacingErrorPercentage: Number(totalPacingError.toFixed(2)),
    averageChapterErrorPercentage: Number(avgChapterError.toFixed(2)),
    maxChapterErrorPercentage: Number(maxChapterError.toFixed(2)),
    chapterAnalyses,
    isPassingPacingKpi: totalPacingError < tolerancePercentage,
  };
}

/**
 * 2. Evaluate Scene Duration Granularity Compliance (Bounds [3s, 8s])
 */
export function evaluateSceneGranularityCompliance(
  scenes: Array<{
    id?: string;
    durationSeconds: number;
  }>,
  minBound: number = 3.0,
  maxBound: number = 8.0
): SceneDurationComplianceResult {
  if (!scenes || scenes.length === 0) {
    return {
      totalScenes: 0,
      compliantScenes: 0,
      nonCompliantScenes: 0,
      complianceRatePercentage: 0,
      minDurationSeconds: 0,
      maxDurationSeconds: 0,
      avgDurationSeconds: 0,
      violatingSceneIds: [],
      isPassingGranularityKpi: false,
    };
  }

  let compliantCount = 0;
  let minDur = Infinity;
  let maxDur = -Infinity;
  let sumDur = 0;
  const violatingSceneIds: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const dur = s.durationSeconds;
    sumDur += dur;

    if (dur < minDur) minDur = dur;
    if (dur > maxDur) maxDur = dur;

    if (dur >= minBound && dur <= maxBound) {
      compliantCount++;
    } else {
      violatingSceneIds.push(s.id ?? `scene_${i}`);
    }
  }

  const total = scenes.length;
  const complianceRate = (compliantCount / total) * 100;
  const avgDur = sumDur / total;

  return {
    totalScenes: total,
    compliantScenes: compliantCount,
    nonCompliantScenes: total - compliantCount,
    complianceRatePercentage: Number(complianceRate.toFixed(2)),
    minDurationSeconds: Number(minDur.toFixed(2)),
    maxDurationSeconds: Number(maxDur.toFixed(2)),
    avgDurationSeconds: Number(avgDur.toFixed(2)),
    violatingSceneIds,
    isPassingGranularityKpi: complianceRate >= 95.0,
  };
}

/**
 * 3. Simulate Synthetic Audio Drift & Evaluate Duration Reconciliation
 */
export function evaluateSyntheticDurationReconciliation(
  targetDurationSeconds: number,
  scenes: Array<{
    id: string;
    plannedDurationSeconds: number;
    syntheticDriftFactor?: number; // e.g. 1.10 (+10%) or 0.90 (-10%)
  }>,
  reconcileFn: (driftedScenes: Array<{ id: string; audioDurationSeconds: number; targetDurationSeconds: number }>) => Array<{ id: string; targetDurationSeconds: number }>
): SyntheticReconciliationAnalysis {
  let totalDriftedSeconds = 0;

  const driftedScenes = scenes.map((s, idx) => {
    // Generate synthetic drift if not specified, default within [-15%, +15%]
    const drift = s.syntheticDriftFactor !== undefined
      ? s.syntheticDriftFactor
      : 1.0 + ((idx % 2 === 0 ? 1 : -1) * (0.05 + ((idx * 3) % 11) / 100));

    const drifted = s.plannedDurationSeconds * drift;
    totalDriftedSeconds += drifted;

    return {
      id: s.id,
      audioDurationSeconds: Number(drifted.toFixed(2)),
      targetDurationSeconds: s.plannedDurationSeconds,
    };
  });

  const reconciledScenes = reconcileFn(driftedScenes);
  const totalReconciledSeconds = reconciledScenes.reduce((sum, s) => sum + s.targetDurationSeconds, 0);

  const appliedDriftPercentage = ((totalDriftedSeconds - targetDurationSeconds) / targetDurationSeconds) * 100;
  const reconciliationErrorPercentage = (Math.abs(totalReconciledSeconds - targetDurationSeconds) / targetDurationSeconds) * 100;

  return {
    originalTargetDurationSeconds: targetDurationSeconds,
    driftedAudioDurationSeconds: Number(totalDriftedSeconds.toFixed(2)),
    reconciledDurationSeconds: Number(totalReconciledSeconds.toFixed(2)),
    appliedDriftPercentage: Number(appliedDriftPercentage.toFixed(2)),
    reconciliationErrorPercentage: Number(reconciliationErrorPercentage.toFixed(2)),
    isFullyReconciled: reconciliationErrorPercentage < 1.0,
  };
}

// Lexicon of solemn historical & documentary terms in Vietnamese
const SOLEMN_HISTORICAL_KEYWORDS = [
  'lịch sử', 'dân tộc', 'tiền nhân', 'bước ngoặt', 'giá trị', 'triều đại',
  'hoàng đế', 'quân đội', 'thắng lợi', 'khởi nghĩa', 'sử sách', 'bảo quốc',
  'quân sĩ', 'chiến công', 'hào hùng', 'trang trọng', 'giang sơn', 'non sông',
  'chủ quyền', 'độc lập', 'chiến trận', 'sử thi', 'anh hùng', 'tổ quốc',
  'vương triều', 'tướng lĩnh', 'bảo vật', 'khảo cứu', 'cột mốc', 'di tích',
  'đại việt', 'văn hiến', 'hưng thịnh', 'quật cường', 'khắc ghi', 'nghìn năm',
  'kháng chiến', 'đánh đuổi', 'bắc thuộc', 'thái thú', 'cứu nước', 'khí phách',
  'nữ tướng', 'nữ vương', 'rạng danh', 'sử vàng', 'oanh liệt', 'hùng tráng',
  'bất khuất', 'nghĩa quân', 'trận đánh', 'chiến thắng', 'chiến dịch', 'dựng cờ',
  'khởi binh', 'ngoại xâm', 'xâm lược', 'đô hộ', 'nước nhà', 'xã tắc',
  'sơn hà', 'bờ cõi', 'quân thù', 'hy sinh', 'kiên cường', 'quang phục',
  'chấn hưng', 'tự chủ', 'muôn đời', 'ngàn năm', 'sử thi', 'dấu ấn',
  'dựng nước', 'nguồn cội', 'truyền thống', 'thời đại', 'khai sinh', 'bảo tồn',
  'tổ tiên', 'đất nước', 'non nước', 'bản sắc', 'thành trì', 'kinh đô',
  'văn minh', 'di sản', 'nguồn gốc', 'tự hào', 'chứng nhân', 'thăng trầm',
  'cha ông', 'vun đắp', 'thái bình', 'văn lang', 'âu lạc', 'ngọc lũ',
];

// Modern slang, casual web abbreviations, and colloquial expressions to penalize in historical tone
const MODERN_SLANG_PATTERNS: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /\b(vãi|vcl|vl|vđ)\b/i, term: 'vãi/vl' },
  { pattern: /\b(chém gió|bốc phét)\b/i, term: 'chém gió' },
  { pattern: /\b(ảo ma|ảo thật đấy)\b/i, term: 'ảo ma' },
  { pattern: /\b(ok|oke|okie)\b/i, term: 'ok' },
  { pattern: /\b(ae|anh em cây khế)\b/i, term: 'ae' },
  { pattern: /\b(bro|homie|cạ cứng)\b/i, term: 'bro' },
  { pattern: /\b(ad|admin)\b/i, term: 'ad' },
  { pattern: /\b(đm|dcm|đcm|đmm)\b/i, term: 'profanity' },
  { pattern: /\b(clgt|clg)\b/i, term: 'clgt' },
  { pattern: /\b(toang|toang rồi)\b/i, term: 'toang' },
  { pattern: /\b(gắt|quá gắt|căng đét)\b/i, term: 'gắt' },
  { pattern: /\b(quẩy|quẩy lên)\b/i, term: 'quẩy' },
  { pattern: /\b(cute|dễ thương quá trời)\b/i, term: 'cute' },
  { pattern: /\b(bựa|bựa nhân)\b/i, term: 'bựa' },
  { pattern: /\b(troll|bị troll)\b/i, term: 'troll' },
  { pattern: /\b(hả dạ|hí hí|kkk|haha)\b/i, term: 'slang reaction' },
  { pattern: /\b(ko|hok|kô|hơm|hem)\b/i, term: 'teencode không' },
  { pattern: /\b(đc|dc)\b/i, term: 'teencode được' },
  { pattern: /\b(ntn|sao z|sao dza)\b/i, term: 'teencode ntn' },
];

/**
 * 4. Multi-Factor Vietnamese Historical Tone, Register & Entity Continuity Analyzer
 */
export function evaluateHistoricalScriptTone(
  scriptText: string,
  expectedEntities: string[] = []
): HistoricalToneEvaluationResult {
  const cleanText = (scriptText || '').trim();
  if (cleanText.length === 0) {
    return {
      toneScorePercentage: 0,
      solemnityScore: 0,
      slangPenalty: 0,
      entityCoveragePercentage: 0,
      detectedSlangTerms: [],
      missingEntities: expectedEntities,
      isPassingTone: false,
      isPassingEntityContinuity: false,
    };
  }

  const normalizedText = cleanText.toLowerCase().normalize('NFC');

  // 1. Solemn Historical Lexicon Score (Target: 2+ unique historical terms -> 100%)
  const matchedKeywords = SOLEMN_HISTORICAL_KEYWORDS.filter((kw) => normalizedText.includes(kw));
  const solemnityScore = Math.min(100, (matchedKeywords.length / 2) * 100);

  // 2. Modern Colloquialism & Slang Penalty (Each detected term incurs -25% penalty)
  const detectedSlangTerms: string[] = [];
  for (const { pattern, term } of MODERN_SLANG_PATTERNS) {
    if (pattern.test(normalizedText)) {
      detectedSlangTerms.push(term);
    }
  }
  const slangPenalty = Math.min(100, detectedSlangTerms.length * 25);

  // 3. Strict Entity Continuity Check (No length > 50 shortcut!)
  let matchedEntitiesCount = 0;
  const missingEntities: string[] = [];

  for (const entity of expectedEntities) {
    const normEntity = entity.trim().toLowerCase().normalize('NFC');
    if (normEntity.length === 0) continue;

    // Check full name or significant entity tokens (e.g. "Ngô Quyền" -> "Ngô Quyền" or "Quang Trung")
    const words = normEntity.split(/\s+/).filter((w) => w.length > 1);
    const fullMatch = normalizedText.includes(normEntity);
    const partialMatch = words.length >= 2 && words.every((w) => normalizedText.includes(w));

    if (fullMatch || partialMatch) {
      matchedEntitiesCount++;
    } else {
      missingEntities.push(entity);
    }
  }

  const totalExpected = expectedEntities.length;
  const entityCoveragePercentage = totalExpected > 0 ? (matchedEntitiesCount / totalExpected) * 100 : 100;

  // Composite Historical Tone Score = 0.7 * Solemnity + 0.3 * EntityCoverage - SlangPenalty
  const rawToneScore = 0.7 * solemnityScore + 0.3 * entityCoveragePercentage - slangPenalty;
  const toneScorePercentage = Number(Math.max(0, Math.min(100, rawToneScore)).toFixed(2));

  const isPassingTone = toneScorePercentage >= 60.0 && detectedSlangTerms.length === 0;
  const isPassingEntityContinuity = totalExpected > 0 ? entityCoveragePercentage >= 40.0 : true;

  return {
    toneScorePercentage,
    solemnityScore: Number(solemnityScore.toFixed(2)),
    slangPenalty,
    entityCoveragePercentage: Number(entityCoveragePercentage.toFixed(2)),
    detectedSlangTerms,
    missingEntities,
    isPassingTone,
    isPassingEntityContinuity,
  };
}
