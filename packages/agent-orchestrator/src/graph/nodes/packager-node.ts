/**
 * JSON Schema v3.2 Packager Agent Node
 * Synthesizes final Remotion-compatible project schema and validates against VideoProjectSchema
 */

import {
  CaptionWord,
  ChronoVideoProps,
  GraphTripleItem,
  HISTORICAL_PERSON_DICTIONARY,
  CORE_ORGS,
  LayoutMode,
  TimelineScene,
  VideoDomain,
  VideoProjectSchema,
  VideoType,
  resolveCanonicalEntity,
} from '@chronoviet/shared-spec';
import {
  alignSpokenWordTimestamps,
  envConfig,
  saveProjectSchema,
} from '@chronoviet/infra';
import { ChronoGraphState, getNodeLogger } from '../state.js';

/**
 * Resolves verified opposing sides for confrontation cards (VERSUS_CARD, ARMY_STRENGTH).
 * Enforces strict domain filtering: only BATTLE videos can generate versus sides.
 * Normalizes all entity IDs to canonical Vietnamese names and returns undefined if 2 distinct sides cannot be verified.
 */
export function resolveDynamicVersusSides(
  sceneText: string,
  triples: GraphTripleItem[] = [],
  mainEntity?: string,
  videoType?: VideoType | VideoDomain,
  userPrompt: string = ''
): {
  leftSide: { name: string; stat: string; color?: string; badge?: string };
  rightSide: { name: string; stat: string; color?: string; badge?: string };
} | undefined {
  // 1. Strictly forbid versus sides for non-battle videos
  if (videoType !== 'BATTLE') {
    return undefined;
  }

  const contextLower = `${userPrompt} ${sceneText}`.toLowerCase();

  // 2. Resolve Protagonist (Left Side)
  let allyName = '';
  let allyStat = 'Chính nghĩa & Quyết chiến';

  if (mainEntity) {
    const resolvedProtagonist = resolveCanonicalEntity(mainEntity);
    allyName = resolvedProtagonist.canonicalName || mainEntity;
    const personEntry = Object.values(HISTORICAL_PERSON_DICTIONARY).find(
      (p) => p.canonicalName.toLowerCase() === allyName.toLowerCase() || p.aliases?.some((a) => a.toLowerCase() === allyName.toLowerCase())
    );
    if (personEntry?.dynasty) {
      allyStat = `Quân dân ${personEntry.dynasty}`;
    }
  }

  // Fallback protagonist if mainEntity is generic or empty
  if (!allyName || /quân\s+đối\s+kháng|giặc|thực\s+dân|quân\s+xâm\s+lược/i.test(allyName)) {
    if (/tây\s+sơn|quang\s+trung|nguyễn\s+huệ/i.test(contextLower)) {
      allyName = 'Nghĩa quân Tây Sơn';
      allyStat = 'Hoàng đế Quang Trung';
    } else if (/nhà\s+trần|trần\s+hưng\s+đạo|trần\s+quốc\s+tuấn/i.test(contextLower)) {
      allyName = 'Quân dân Nhà Trần';
      allyStat = 'Quốc công Tiết chế Trần Hưng Đạo';
    } else if (/lê\s+lợi|nguyễn\s+trãi|lam\s+sơn/i.test(contextLower)) {
      allyName = 'Nghĩa quân Lam Sơn';
      allyStat = 'Bình Định Vương Lê Lợi';
    } else if (/ngô\s+quyền/i.test(contextLower)) {
      allyName = 'Nghĩa quân Ngô Quyền';
      allyStat = 'Trận địa cọc Bạch Đằng';
    } else if (/lê\s+hoàn|tiền\s+lê/i.test(contextLower)) {
      allyName = 'Quân dân Đại Cồ Việt';
      allyStat = 'Thập đạo Tướng quân Lê Hoàn';
    } else if (/lý\s+thường\s+kiệt/i.test(contextLower)) {
      allyName = 'Quân dân Nhà Lý';
      allyStat = 'Thái úy Lý Thường Kiệt';
    } else if (/hai\s+bà\s+trưng|trưng\s+trắc|trưng\s+nhị/i.test(contextLower)) {
      allyName = 'Nghĩa quân Hai Bà Trưng';
      allyStat = 'Trưng Nữ Vương';
    } else if (/võ\s+nguyên\s+giáp|điện\s+biên\s+phủ/i.test(contextLower)) {
      allyName = 'Quân đội Nhân dân Việt Nam';
      allyStat = 'Đại tướng Võ Nguyên Giáp';
    }
  }

  // 3. Resolve Adversary (Right Side)
  let enemyName = '';
  let enemyStat = 'Lực lượng đối kháng';

  // Check triples first
  for (const triple of triples) {
    const srcResolved = resolveCanonicalEntity(triple.source);
    const tgtResolved = resolveCanonicalEntity(triple.target);

    for (const ent of [srcResolved, tgtResolved]) {
      if (ent.entityId && /man_thanh|nguyen_mong|nam_han|tong|phap|my|xiem/i.test(ent.entityId)) {
        enemyName = ent.canonicalName;
        break;
      }
      const adv = (ent as any).docMetadata?.adversary || (ent as any).adversary;
      if (adv) {
        enemyName = adv;
        break;
      }
    }
    if (enemyName) break;
  }

  // If not found in triples, check canonical documents or events referenced in text
  if (!enemyName && mainEntity) {
    const resolvedDocOrEvent = resolveCanonicalEntity(mainEntity);
    const adv = (resolvedDocOrEvent as any).docMetadata?.adversary || (resolvedDocOrEvent as any).adversary;
    if (adv) {
      enemyName = adv;
    }
  }

  // Check context for known canonical adversary organizations
  if (!enemyName) {
    if (/mãn\s+thanh|quân\s+thanh|tôn\s+sĩ\s+nghị|sầm\s+nghi\s+đống/i.test(contextLower)) {
      enemyName = resolveCanonicalEntity('org_quan_man_thanh').canonicalName || 'Quân Mãn Thanh';
      enemyStat = '29 vạn quân (Tôn Sĩ Nghị)';
    } else if (/nguyên\s+mông|mông\s+cổ|thoát\s+hoan|ô\s+mã\s+nhi|phàn\s+tiếp/i.test(contextLower)) {
      enemyName = resolveCanonicalEntity('org_quan_nguyen_mong').canonicalName || 'Quân Nguyên Mông';
      enemyStat = 'Ô Mã Nhi & Phàn Tiếp';
    } else if (/nam\s+hán|lưu\s+hoằng\s+tháo/i.test(contextLower)) {
      enemyName = 'Quân Nam Hán';
      enemyStat = 'Chủ tướng Lưu Hoằng Tháo';
    } else if (/quân\s+tống|nhà\s+tống|hầu\s+nhân\s+bảo|quách\s+quỳ|triệu\s+tiết/i.test(contextLower)) {
      enemyName = 'Quân xâm lược Nhà Tống';
      enemyStat = 'Quách Quỳ & Triệu Tiết';
    } else if (/quân\s+xiêm|rạch\s+gầm|xoài\s+mút|chiêu\s+tăng/i.test(contextLower)) {
      enemyName = 'Quân Xiêm La';
      enemyStat = '5 vạn quân (Chiêu Tăng)';
    } else if (/(?<!hồ\s*chí\s*)(?:quân\s+minh|nhà\s+minh)|liễu\s+thăng|vương\s+thông|mộc\s+thạnh/i.test(contextLower)) {
      enemyName = 'Quân xâm lược Nhà Minh';
      enemyStat = 'Liễu Thăng & Vương Thông';
    } else if (/thực\s+dân\s+pháp|quân\s+viễn\s+chinh\s+pháp/i.test(contextLower) || (/\bpháp\b/i.test(contextLower) && /xâm\s+lược|chiến\s+tranh|đồn|hỏa\s+lực/i.test(contextLower))) {
      enemyName = 'Thực dân Pháp';
      enemyStat = 'Quân viễn chinh & Hỏa lực';
    } else if (/đế\s+quốc\s+mỹ|quân\s+mỹ/i.test(contextLower)) {
      enemyName = 'Đế quốc Mỹ';
      enemyStat = 'Lực lượng viễn chinh & Không quân';
    }
  }

  // Must have both valid, distinct opposing sides
  if (!allyName || !enemyName || allyName.toLowerCase() === enemyName.toLowerCase()) {
    return undefined;
  }

  return {
    leftSide: { name: allyName, stat: allyStat, color: '#C89D35' },
    rightSide: { name: enemyName, stat: enemyStat, color: '#9B1B1B' },
  };
}

export async function packagerNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'packager');
  nodeLog.info('orchestrator.packager_started', `Packaging ${state.scenes.length} scenes into project_schema.json`, {
    projectId: state.projectId,
  });

  const fps = 30;
  const AUDIO_LEAD_IN_FRAMES = 12; // ~400ms lead-in breathing margin before audio starts
  const timeline: TimelineScene[] = [];
  const allCaptions: CaptionWord[] = [];
  let currentGlobalFrame = 0;

  for (let i = 0; i < state.scenes.length; i++) {
    const scene = state.scenes[i];
    const targetFrames = Math.ceil((scene.targetDurationSeconds || 3) * fps);
    const audioFramesWithPadding = Math.ceil(((scene.audioDurationSeconds || 0) + (AUDIO_LEAD_IN_FRAMES / fps) + 0.4) * fps);
    const durationInFrames = Math.max(90, Math.max(targetFrames, audioFramesWithPadding));

    const sceneCaptions: CaptionWord[] = [];
    if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      const aligned = alignSpokenWordTimestamps(scene.voiceoverText, scene.wordTimestamps, fps, AUDIO_LEAD_IN_FRAMES);
      for (const cw of aligned) {
        const sceneCapWord: CaptionWord = {
          word: cw.word,
          startFrame: cw.startFrame,
          endFrame: cw.endFrame,
        };
        sceneCaptions.push(sceneCapWord);

        const globalCapWord: CaptionWord = {
          word: cw.word,
          startFrame: currentGlobalFrame + cw.startFrame,
          endFrame: currentGlobalFrame + cw.endFrame,
        };
        allCaptions.push(globalCapWord);
      }
    }

    const sceneAudioUrl = scene.audioPath;
    const assetUrl = scene.selectedAsset
      ? scene.selectedAsset.localPath || scene.selectedAsset.imageUrl
      : undefined;

    const currentChapter = state.chapters?.[scene.chapterIndex ?? 0];
    const chapterTitle = currentChapter?.title;
    const chapterNumber = typeof scene.chapterIndex === 'number' ? String(scene.chapterIndex + 1) : undefined;
    const introducedEntities = currentChapter?.introducedEntities || [];

    // Context-Aware Entity Resolution:
    // Match entity appearing directly in this scene's voiceover text,
    // prioritizing canonical protagonist over invading antagonists
    const textLower = scene.voiceoverText.toLowerCase();
    const verifiedEntities = (state.ragContext?.verifiedContext || []).map((e) => e.canonicalName);
    const candidateEntities = [...introducedEntities, ...verifiedEntities];
    const matchedEntity = candidateEntities.find((ent) => ent && ent.length > 2 && textLower.includes(ent.toLowerCase()));

    // Fallback if no entity explicitly mentioned in text: prioritize non-enemy entity
    const nonAntagonistEntity = introducedEntities.find(
      (ent) => !/quân (mãn thanh|nguyên mông|thanh|minh|xiêm|pháp|giặc|địch)|nhà thanh/i.test(ent)
    );
    const defaultProtagonist = verifiedEntities.find(
      (ent) => !/quân (mãn thanh|nguyên mông|thanh|minh|xiêm|pháp|giặc|địch)|nhà thanh/i.test(ent)
    ) || state.userPrompt.split(/đại phá|đánh tan|tiêu diệt|chiến thắng/i)[0].trim();

    const rawMain = matchedEntity || nonAntagonistEntity || defaultProtagonist || introducedEntities[0];
    const resolvedMain = rawMain ? resolveCanonicalEntity(rawMain) : undefined;
    const mainEntity = resolvedMain?.canonicalName || rawMain;

    const isLocation = /vân đồn|bạch đằng|sông|thành|đền|núi|cửa biển|kinh thành|địa danh|quảng yên|hoa lư|thăng long|chi lăng|vạn kiếp|tam điệp|biện sơn|ngọc hồi|đống đa|phú xuân/i.test(mainEntity || '');
    const isBattleOrEvent = /trận|chiến|khởi nghĩa|hội nghị|chiến dịch|đại phá|duyệt binh|hành quân/i.test(mainEntity || '');
    const entityRole = isLocation ? 'Địa danh lịch sử' : (isBattleOrEvent ? 'Sự kiện lịch sử' : 'Nhân vật lịch sử');

    // Extract numeric stats from scene text if layout is STAT_CARD or ARMY_STRENGTH
    let statItems: { label: string; value: string; color?: string }[] | undefined = undefined;
    if (scene.layoutMode === 'STAT_CARD' || scene.layoutMode === 'ARMY_STRENGTH') {
      const statMatches = Array.from(
        scene.voiceoverText.matchAll(/(\d+(?:[.,]\d+)?)\s*(vạn|nghìn|triệu|chiến thuyền|thuyền chiến|quân|binh sĩ|khẩu thần công|ngày đêm|năm|người lính|đạo|voi chiến)/gi)
      );
      if (statMatches.length > 0) {
        statItems = statMatches.slice(0, 3).map((m, idx) => ({
          label: idx === 0 ? 'Thông số ghi nhận' : (idx === 1 ? 'Quy mô / Dữ liệu' : 'Niên đại / Thống kê'),
          value: `${m[1]} ${m[2]}`,
          color: idx === 0 ? '#C89D35' : (idx === 1 ? '#D4AF37' : '#B8860B'),
        }));
      } else if (scene.layoutMode === 'STAT_CARD') {
        statItems = [
          { label: 'Thông số ghi nhận', value: 'Tư liệu lịch sử', color: '#C89D35' },
        ];
      }
    }

    // Extract milestones if layout is TIMELINE_CHRONO
    let milestones: { time: string; title: string; desc?: string }[] | undefined = undefined;
    if (scene.layoutMode === 'TIMELINE_CHRONO') {
      const yearMatches = scene.voiceoverText.match(/\b(năm\s+\d{3,4}|tháng\s+\d{1,2}(?:\s+năm\s+\d{3,4})?|ngày\s+\d{1,2}(?:\s+tháng\s+\d{1,2})?|đêm\s+30\s+tết|mùng\s+\d{1,2}\s+tết)\b/gi);
      if (yearMatches && yearMatches.length > 0) {
        const cleanSnippet = (s: string) => s.replace(/["“”'‘’]/g, '').slice(0, 60).trim();
        if (yearMatches.length === 1) {
          milestones = [
            { time: yearMatches[0], title: 'Cột mốc lịch sử', desc: cleanSnippet(scene.voiceoverText) },
            { time: 'Dấu ấn', title: chapterTitle || 'Ý nghĩa lịch sử', desc: 'Di sản muôn đời' },
          ];
        } else if (yearMatches.length === 2) {
          milestones = [
            { time: yearMatches[0], title: 'Giai đoạn khởi đầu', desc: cleanSnippet(scene.voiceoverText) },
            { time: yearMatches[1], title: chapterTitle || 'Bước ngoặt sự nghiệp', desc: 'Chuyển biến quan trọng' },
          ];
        } else {
          milestones = [
            { time: yearMatches[0], title: 'Khởi đầu', desc: 'Bắt đầu tiến trình lịch sử' },
            { time: yearMatches[1], title: 'Phát triển', desc: 'Bước ngoặt quan trọng' },
            { time: yearMatches[yearMatches.length - 1], title: chapterTitle || 'Dấu ấn', desc: 'Di sản lịch sử' },
          ];
        }
      }
    }

    // Configure versus sides dynamically if layout is VERSUS_CARD or ARMY_STRENGTH
    let leftSide: { name: string; stat: string; color?: string; badge?: string } | undefined = undefined;
    let rightSide: { name: string; stat: string; color?: string; badge?: string } | undefined = undefined;
    if (scene.layoutMode === 'VERSUS_CARD' || scene.layoutMode === 'ARMY_STRENGTH') {
      const versusSides = resolveDynamicVersusSides(
        scene.voiceoverText,
        state.ragContext?.triples,
        mainEntity,
        state.videoType,
        state.userPrompt
      );

      if (versusSides) {
        leftSide = versusSides.leftSide;
        rightSide = versusSides.rightSide;
      } else {
        // Auto-Demote layout safely if lacking 2 verified opposing sides
        const demotedLayout: LayoutMode = assetUrl ? 'HISTORICAL_FRAME' : 'CHARACTER_PROFILE';
        nodeLog.info('orchestrator.packager_auto_demote_versus', `Demoting ${scene.layoutMode} to ${demotedLayout} for scene ${scene.sceneId} due to lack of verified opposing sides`, {
          sceneId: scene.sceneId,
          originalLayout: scene.layoutMode,
          demotedLayout,
        });
        scene.layoutMode = demotedLayout;
      }
    }

    // Configure quoteText & author if layout is QUOTE_SLIDE or ROYAL_DECREE
    let quoteText: string | undefined = undefined;
    let author: string | undefined = undefined;
    if (scene.layoutMode?.includes('QUOTE') || scene.layoutMode === 'ROYAL_DECREE') {
      const quoteMatch = scene.voiceoverText.match(/["“'‘]([^"”'’\n]{5,300})["”'’]/);
      quoteText = quoteMatch ? quoteMatch[1].trim() : scene.voiceoverText;

      const candidates = [mainEntity, introducedEntities[0]].filter(Boolean);
      for (const cand of candidates) {
        const resolved = resolveCanonicalEntity(cand!);
        const docAuthor = (resolved as any).docMetadata?.author || (resolved as any).author;
        if (docAuthor) {
          author = docAuthor;
          break;
        } else if (resolved.canonicalName) {
          author = resolved.canonicalName;
          break;
        }
      }
      if (!author) {
        author = mainEntity || 'Nhân vật lịch sử';
      }
    }

    // Extract artifactInfo if layout is MUSEUM_TAG or ARTIFACT_INSPECT
    let artifactInfo: { origin?: string; material?: string; period?: string; location?: string; dimensions?: string } | undefined = undefined;
    if (scene.layoutMode === 'MUSEUM_TAG' || scene.layoutMode === 'ARTIFACT_INSPECT') {
      const matMatch = scene.voiceoverText.match(/\b(đồng thau|hợp kim đồng|đồng|đá|gốm|sắt|vàng|bạc|ngọc|gỗ)\b/i);
      const dimMatch = scene.voiceoverText.match(/\b(đường kính\s*[:\d.,]+(?:\s*cm|\s*mm|\s*m)?|cao\s*[:\d.,]+(?:\s*cm|\s*mm|\s*m)?|nặng\s*[:\d.,]+(?:\s*kg|\s*tấn)?)\b/i);
      const locMatch = scene.voiceoverText.match(/\b(khai quật tại\s*[^.,;\n]+|tìm thấy tại\s*[^.,;\n]+|lưu giữ tại\s*[^.,;\n]+|Bảo tàng\s*[^.,;\n]+)\b/i);
      const periodMatch = scene.voiceoverText.match(/\b(thế kỷ\s+[IVXLCDM\d]+(?:\s*TCN|\s*trước công nguyên)?|thời kỳ\s*[^.,;\n]+|văn hóa\s*[^.,;\n]+)\b/i);

      artifactInfo = {
        material: matMatch ? matMatch[1].trim() : 'Kim loại / Hợp kim cổ truyền',
        dimensions: dimMatch ? dimMatch[1].trim() : 'Hiện vật bảo tồn nguyên bản',
        origin: locMatch ? locMatch[1].trim() : 'Di chỉ khảo cổ học Việt Nam',
        period: periodMatch ? periodMatch[1].trim() : (chapterTitle || 'Thời kỳ lịch sử'),
        location: 'Bảo tàng Lịch sử Quốc gia',
      };
    }

    // Extract theories if layout is SPLIT_THEORY
    let theories: { title: string; desc: string; probability?: string }[] | undefined = undefined;
    if (scene.layoutMode === 'SPLIT_THEORY') {
      const sentences = scene.voiceoverText.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length >= 2) {
        theories = [
          {
            title: 'GIẢ THUYẾT 1: QUAN ĐIỂM CHÍNH THỐNG',
            desc: sentences[0].slice(0, 150),
            probability: '50% Khả năng',
          },
          {
            title: 'GIẢ THUYẾT 2: KHẢO CỨU ĐỐI LẬP',
            desc: sentences.slice(1).join(' ').slice(0, 150),
            probability: '50% Khả năng',
          },
        ];
      } else {
        theories = [
          {
            title: 'GIẢ THUYẾT A: SỬ SÁCH TRUYỀN THỐNG',
            desc: scene.voiceoverText.slice(0, 120),
            probability: 'Ghi nhận trong chính sử',
          },
          {
            title: 'GIẢ THUYẾT B: KHẢO CỨU HIỆN ĐẠI',
            desc: 'Quan điểm phản biện từ các nhà nghiên cứu lịch sử hiện đại.',
            probability: 'Giả thuyết mở rộng',
          },
        ];
      }
    }

    // Extract bulletPoints if layout is BULLET_HIGHLIGHT or OUTRO_CARD
    let bulletPoints: string[] | undefined = undefined;
    if (scene.layoutMode === 'BULLET_HIGHLIGHT' || scene.layoutMode === 'OUTRO_CARD') {
      const candidateSentences = scene.voiceoverText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.replace(/["“”'‘’]/g, '').trim())
        .filter((s) => s.length >= 10);
      if (candidateSentences.length > 0) {
        bulletPoints = candidateSentences.slice(0, 3);
      } else {
        bulletPoints = [
          chapterTitle || 'Dấu ấn lịch sử',
          'Bước ngoặt thời đại',
          'Di sản muôn đời',
        ];
      }
    }

    const overlaySubtitle = chapterTitle
      ? `Hồi ${chapterNumber}: ${chapterTitle}`
      : (state.userPrompt || 'Tư liệu lịch sử');

    const overlayData = {
      title: chapterTitle || state.userPrompt,
      subtitle: overlaySubtitle,
      chapterNumber,
      seriesTitle: 'CHRONOVIET DOCUMENTARY',
      quoteText,
      author,
      details: scene.voiceoverText,
      name: mainEntity,
      role: entityRole,
      statItems,
      milestones,
      leftSide,
      rightSide,
      artifactInfo,
      theories,
      bulletPoints,
      position: 'CENTER' as const,
    };

    const timelineScene: TimelineScene = {
      id: scene.sceneId,
      chapterIndex: scene.chapterIndex,
      durationInFrames,
      layoutMode: scene.layoutMode,
      text: scene.voiceoverText,
      sceneAudioUrl,
      assetUrl,
      attribution: scene.selectedAsset
        ? {
            author: scene.selectedAsset.author || 'Wikimedia Commons Contributor',
            sourceUrl: scene.selectedAsset.sourceUrl || scene.selectedAsset.imageUrl,
            license: scene.selectedAsset.license,
          }
        : undefined,
      captions: sceneCaptions.length > 0 ? sceneCaptions : undefined,
      overlayData,
    };

    timeline.push(timelineScene);
    currentGlobalFrame += durationInFrames;
  }

  const templateId = state.templateId || 'HISTORICAL_DOCUMENTARY';
  const aspectRatio = templateId === 'QUICK_SHORTS' ? '9:16' : '16:9';

  const rawVideoProps: ChronoVideoProps = {
    title: state.userPrompt,
    aspectRatio,
    templateId,
    fps,
    defaultLayoutMode: 'HISTORICAL_FRAME',
    timeline,
    captions: allCaptions.length > 0 ? allCaptions : undefined,
  };

  // Validate with Zod Schema (SSOT)
  const validatedSchema = VideoProjectSchema.parse(rawVideoProps);

  // Save to project workspace disk
  try {
    saveProjectSchema(state.projectId, validatedSchema, state.customBaseDir);
    nodeLog.info('orchestrator.schema_saved', `Saved validated project_schema.json to workspace for ${state.projectId}`);
  } catch (err: any) {
    nodeLog.warn('orchestrator.save_schema_error', `Could not save to disk workspace: ${err.message}`);
  }

  let finalStatus: 'PACKAGED' | 'RENDERING' | 'COMPLETED' = 'PACKAGED';

  // Auto-enqueue to BullMQ remotion-render-queue
  const autoDispatch = envConfig.AUTO_DISPATCH_RENDER !== false && process.env.AUTO_DISPATCH_RENDER !== 'false';
  const isTestEnv = process.env.NODE_ENV === 'test' || envConfig.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  if (autoDispatch && !isTestEnv) {
    try {
      const { enqueueRenderJob, getProjectPaths } = await import('@chronoviet/infra');
      const { jobId } = await enqueueRenderJob(state.projectId, {
        correlationId: state.correlationId || state.projectId,
        outputFormat: 'mp4',
      });
      finalStatus = 'RENDERING';

      // Persist active jobId in metadata.json for accurate abort and progress tracking
      try {
        const paths = getProjectPaths(state.projectId, state.customBaseDir);
        let metadata: Record<string, any> = { projectId: state.projectId };
        const fs = await import('fs');
        if (fs.existsSync(paths.metadataFile)) {
          try {
            metadata = JSON.parse(fs.readFileSync(paths.metadataFile, 'utf-8'));
          } catch {}
        }
        metadata.status = 'RENDERING';
        metadata.renderJobId = jobId;
        metadata.enqueuedAt = new Date().toISOString();
        metadata.updatedAt = new Date().toISOString();
        fs.writeFileSync(paths.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
      } catch (metaErr: any) {
        nodeLog.warn('orchestrator.metadata_job_id_warning', `Could not persist renderJobId to metadata: ${metaErr.message}`);
      }

      nodeLog.info('orchestrator.auto_render_dispatched', `Auto-dispatched project ${state.projectId} to render queue (jobId: ${jobId})`, {
        jobId,
        projectId: state.projectId,
      });
    } catch (enqueueErr: any) {
      nodeLog.warn('orchestrator.auto_render_enqueue_failed', `Failed to auto-dispatch render: ${enqueueErr.message}`);
      finalStatus = 'PACKAGED';
    }
  } else {
    finalStatus = 'COMPLETED';
  }

  return {
    status: finalStatus,
    currentStep: 12,
    videoProps: validatedSchema,
  };
}
