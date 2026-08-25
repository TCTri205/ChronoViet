/**
 * Micro-Step 1C: Visual Query Planning & Keyword Extractor Agent
 * Analyzes each IMAGE scene and generates structured ImageSearchToolInput
 * (bilingual queries, visual type, historical period) for the Research Agent Tool.
 */

import {
  SceneGeneration,
} from '@chronoviet/shared-spec';
import {
  callLlm,
  createLogger,
  envConfig,
  ImageSearchToolInput,
  ImageSearchVisualType,
  parseLlmJson,
} from '@chronoviet/infra';
import { ChronoGraphState, getNodeLogger } from '../state.js';
import { VIETNAMESE_STOP_WORDS } from '../../guardrails/nli-hallucination-judge.js';

const log = createLogger({ service: 'agent-orchestrator' });

export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export const HISTORICAL_BILINGUAL_GLOSSARY: Record<string, string> = {
  // Battles & Historic Events
  'trận bạch đằng': 'Battle of Bach Dang',
  'trận ngọc hồi - đống đa': 'Battle of Ngoc Hoi - Dong Da',
  'trận ngọc hồi đống đa': 'Battle of Ngoc Hoi Dong Da',
  'trận như nguyệt': 'Battle of Nhu Nguyet',
  'trận rạch gầm - xoài mút': 'Battle of Rach Gam - Xoai Mut',
  'trận rạch gầm xoài mút': 'Battle of Rach Gam Xoai Mut',
  'trận chi lăng - xương giang': 'Battle of Chi Lang - Xuong Giang',
  'chiến dịch điện biên phủ': 'Dien Bien Phu Campaign',
  'chiến dịch hồ chí minh': 'Ho Chi Minh Campaign',
  'khởi nghĩa hai bà trưng': 'Trung Sisters uprising',
  'khởi nghĩa bà triệu': 'Lady Trieu uprising',
  'khởi nghĩa lam sơn': 'Lam Son uprising',
  'khởi nghĩa tây sơn': 'Tay Son uprising',
  'đại phá quân nam hán': 'Victory over Southern Han army',
  'đại phá quân thanh': 'Victory over Qing army',
  'đại phá quân nguyên mông': 'Victory over Mongol invaders',
  'chiếu dời đô': 'Edict on the Transfer of the Capital',
  'hịch tướng sĩ': 'Proclamation to the Officers',
  'bình ngô đại cáo': 'Great Proclamation upon the Pacification of the Wu',

  // Compound Terms & Artifacts
  'trống đồng đông sơn': 'Dong Son bronze drum',
  'trống đồng': 'bronze drum',
  'tượng đài quang trung': 'Statue of Quang Trung',
  'gò đống đa': 'Dong Da Mound',
  'bãi cọc bạch đằng': 'Bach Dang wooden stakes',
  'hoàng thành thăng long': 'Imperial Citadel of Thang Long',
  'cố đô huế': 'Hue Imperial City',
  'thành nhà hồ': 'Citadel of the Ho Dynasty',
  'chùa một cột': 'One Pillar Pagoda',
  'văn miếu quốc tử giám': 'Temple of Literature',
  'đền hùng': 'Hung Kings Temple',

  // Keywords & Generic Roles
  'tượng đài': 'Statue of',
  'tượng': 'Statue of',
  'lăng mộ': 'Mausoleum of',
  'lăng': 'Mausoleum of',
  'đền thờ': 'Temple of',
  'đền': 'Temple of',
  'chùa': 'Pagoda',
  'hoàng thành': 'Imperial Citadel of',
  'kinh thành': 'Citadel of',
  'thành cổ': 'Ancient citadel of',
  'di tích': 'Historical site of',
  'di chỉ': 'Archaeological site of',
  'bãi cọc': 'Wooden stakes site of',
  'cổ vật': 'artifact',
  'bảo vật quốc gia': 'national treasure',
  'bản đồ': 'Map of',
  'chân dung': 'Portrait of',
  'phù điêu': 'Relief of',
  'tranh vẽ': 'Painting of',
  'trận': 'Battle of',
  'chiến dịch': 'Campaign',
  'khởi nghĩa': 'Uprising of',
  'đại thắng': 'Great victory of',
  'đại phá': 'Victory over',

  // Figures
  'ngô quyền': 'Ngo Quyen',
  'đinh bộ lĩnh': 'Dinh Bo Linh',
  'đinh tiên hoàng': 'Dinh Tien Hoang',
  'lê hoàn': 'Le Hoan',
  'lê đại hành': 'Le Dai Hanh',
  'lý thái tổ': 'Ly Thai To',
  'lý công uẩn': 'Ly Cong Uan',
  'lý thường kiệt': 'Ly Thuong Kiet',
  'trần hưng đạo': 'Tran Hung Dao',
  'trần quốc tuấn': 'Tran Quoc Tuan',
  'trần thái tông': 'Tran Thai Tong',
  'trần nhân tông': 'Tran Nhan Tong',
  'quang trung': 'Quang Trung',
  'nguyễn huệ': 'Nguyen Hue',
  'hai bà trưng': 'Trung Sisters',
  'bà triệu': 'Lady Trieu',
  'lê lợi': 'Le Loi',
  'nguyễn trãi': 'Nguyen Trai',
  'hồ chí minh': 'Ho Chi Minh',
  'võ nguyên giáp': 'Vo Nguyen Giap',
  'đông sơn': 'Dong Son',
  'bạch đằng': 'Bach Dang',

  // Periods & Dynasties
  'triều đại': 'Dynasty',
  'thời kỳ': 'Period',
  'nhà ngô': 'Ngo Dynasty',
  'nhà đinh': 'Dinh Dynasty',
  'nhà tiền lê': 'Early Le Dynasty',
  'nhà lý': 'Ly Dynasty',
  'nhà trần': 'Tran Dynasty',
  'nhà hậu lê': 'Later Le Dynasty',
  'nhà tây sơn': 'Tay Son Dynasty',
  'nhà nguyễn': 'Nguyen Dynasty',
  'triều nguyễn': 'Nguyen Dynasty',
};

export const HISTORICAL_FRENCH_GLOSSARY: Record<string, string> = {
  // Battles, Campaigns & Historical Events
  'chiến dịch điện biên phủ': 'Bataille de Dien Bien Phu',
  'trận điện biên phủ': 'Bataille de Dien Bien Phu',
  'điện biên phủ': 'Dien Bien Phu',
  'trận bạch đằng': 'Bataille du fleuve Bach Dang',
  'bạch đằng': 'Bach Dang',
  'trận ngọc hồi - đống đa': 'Bataille de Ngoc Hoi Dong Da',
  'trận ngọc hồi đống đa': 'Bataille de Ngoc Hoi Dong Da',
  'trận như nguyệt': 'Bataille de la riviere Nhu Nguyet',
  'trận rạch gầm - xoài mút': 'Bataille de Rach Gam Xoai Mut',
  'trận rạch gầm xoài mút': 'Bataille de Rach Gam Xoai Mut',
  'trận chi lăng - xương giang': 'Bataille de Chi Lang Xuong Giang',
  'khởi nghĩa hai bà trưng': 'Insurrection des soeurs Trung',
  'khởi nghĩa bà triệu': 'Insurrection de Dame Trieu',
  'khởi nghĩa lam sơn': 'Insurrection de Lam Son',
  'khởi nghĩa tây sơn': 'Insurrection des Tay Son',
  'khởi nghĩa yên thế': 'Insurrection de Yen The',
  'khởi nghĩa ba đình': 'Insurrection de Ba Dinh',
  'phong trào cần vương': 'Mouvement Can Vuong',
  'phong trào đông du': 'Mouvement Dong Du',
  'cách mạng tháng tám': "Revolution d'Aout 1945",
  'tuyên ngôn độc lập': "Declaration d'independance du Vietnam",
  'chiến dịch hồ chí minh': 'Campagne Ho Chi Minh',
  'chiến tranh đông dương': "Guerre d'Indochine",
  'đại phá quân nam hán': 'Victoire sur les Han du Sud',
  'đại phá quân thanh': 'Victoire sur les Qing',
  'đại phá quân nguyên mông': 'Victoire sur les Mongols',
  'chiếu dời đô': 'Edit du transfert de la capitale',
  'hịch tướng sĩ': 'Harangue aux officiers',
  'bình ngô đại cáo': 'Grande proclamation sur la pacification des Wu',

  // Compound Terms, Citadels, Archival Entities & Sites
  'kinh thành huế': 'Citadelle de Hue',
  'hoàng thành huế': 'Cite imperiale de Hue',
  'cố đô huế': 'Cite imperiale de Hue',
  'ngọ môn': 'Porte du Midi Ngo Mon Hue',
  'hoàng thành thăng long': 'Cite imperiale de Thang Long',
  'thăng long': 'Thang Long',
  'văn miếu quốc tử giám': 'Temple de la Litterature de Hanoi',
  'văn miếu': 'Temple de la Litterature',
  'chùa một cột': 'Pagode au pilier unique',
  'thành nhà hồ': 'Citadelle de la dynastie Ho',
  'cố đô hoa lư': 'Ancienne capitale de Hoa Lu',
  'hoa lư': 'Hoa Lu',
  'đền hùng': 'Temple des rois Hung',
  'bãi cọc bạch đằng': 'Pieux de Bach Dang',
  'chùa cầu': 'Pont couvert japonais de Hoi An',
  'phố cổ hội an': 'Vieille ville de Hoi An',
  'hội an': 'Faifo Hoi An',
  'cầu long biên': 'Pont Paul Doumer',
  'nhà hát lớn hà nội': 'Grand Theatre de Hanoi',
  'nhà thờ đức bà': 'Cathedrale Notre-Dame de Saigon',
  'dinh độc lập': "Palais de l'Independance",
  'tháp rùa': 'Tour de la Tortue Hanoi',
  'hồ gươm': 'Lac Hoan Kiem Hanoi',
  'hồ hoàn kiếm': 'Lac Hoan Kiem Hanoi',
  'sông gianh': 'Riviere Gianh',
  'gò đống đa': 'Tertre de Dong Da',
  'đền hát môn': 'Temple de Hat Mon',
  'châu bản triều nguyễn': 'Archives royales des Nguyen',
  'mộc bản triều nguyễn': 'Planches xylographiques des Nguyen',
  'đại nam thực lục': 'Chroniques veridiques du Dai Nam',
  'trống đồng đông sơn': 'Tambour de bronze de Dong Son',
  'trống đồng': 'Tambour de bronze',
  'bảo vật quốc gia': 'Tresor national',
  'cổ vật': 'Antiquite',

  // Regions & Colonial Geography
  'bắc kỳ': 'Tonkin',
  'trung kỳ': 'Annam',
  'nam kỳ': 'Cochinchine',
  'đông dương': 'Indochine',
  'pháp thuộc': 'Indochine francaise',
  'hà nội': 'Hanoi',
  'sài gòn': 'Saigon',
  'hải phòng': 'Haiphong',
  'đà nẵng': 'Tourane',
  'huế': 'Hue',

  // Figures
  'vua gia long': 'Empereur Gia Long',
  'gia long': 'Gia Long',
  'vua minh mạng': 'Empereur Minh Mang',
  'minh mạng': 'Minh Mang',
  'vua thiệu trị': 'Empereur Thieu Tri',
  'thiệu trị': 'Thieu Tri',
  'vua tự đức': 'Empereur Tu Duc',
  'tự đức': 'Tu Duc',
  'vua hàm nghi': 'Empereur Ham Nghi',
  'hàm nghi': 'Ham Nghi',
  'vua đồng khánh': 'Empereur Dong Khanh',
  'đồng khánh': 'Dong Khanh',
  'vua thành thái': 'Empereur Thanh Thai',
  'thành thái': 'Thanh Thai',
  'vua duy tân': 'Empereur Duy Tan',
  'duy tân': 'Duy Tan',
  'vua khải định': 'Empereur Khai Dinh',
  'khải định': 'Khai Dinh',
  'vua bảo đại': 'Empereur Bao Dai',
  'bảo đại': 'Bao Dai',
  'hoàng hoa thám': 'Hoang Hoa Tham De Tham',
  'đề thám': 'De Tham',
  'phan bội châu': 'Phan Boi Chau',
  'phan châu trinh': 'Phan Chau Trinh',
  'quang trung': 'Empereur Quang Trung',
  'nguyễn huệ': 'Nguyen Hue',
  'nguyễn trãi': 'Nguyen Trai',
  'lê lợi': 'Le Loi',
  'trần hưng đạo': 'Tran Hung Dao',
  'trần quốc tuấn': 'Tran Quoc Tuan',
  'lý thường kiệt': 'Ly Thuong Kiet',
  'ngô quyền': 'Ngo Quyen',
  'đinh bộ lĩnh': 'Dinh Bo Linh',
  'đinh tiên hoàng': 'Dinh Tien Hoang',
  'lê hoàn': 'Le Hoan',
  'lê đại hành': 'Le Dai Hanh',
  'lý thái tổ': 'Ly Thai To',
  'lý công uẩn': 'Ly Cong Uan',
  'hồ chí minh': 'Ho Chi Minh',
  'võ nguyên giáp': 'Vo Nguyen Giap',
  'hai bà trưng': 'Soeurs Trung',
  'bà triệu': 'Dame Trieu',

  // Periods & Dynasties
  'triều đại': 'Dynastie',
  'thời kỳ': 'Periode',
  'triều nguyễn': 'Dynastie des Nguyen',
  'nhà nguyễn': 'Dynastie des Nguyen',
  'nhà tây sơn': 'Dynastie Tay Son',
  'nhà trịnh': 'Seigneurs Trinh',
  'chúa nguyễn': 'Seigneurs Nguyen',
  'nhà hậu lê': 'Dynastie des Le posterieurs',
  'nhà hồ': 'Dynastie Ho',
  'nhà trần': 'Dynastie des Tran',
  'nhà lý': 'Dynastie des Ly',
  'nhà tiền lê': 'Dynastie des Le anterieurs',
  'nhà đinh': 'Dynastie Dinh',
  'nhà ngô': 'Dynastie Ngo',
  'bắc thuộc': 'Domination chinoise',

  // Keywords & Roles
  'tượng đài': 'Statue de',
  'tượng': 'Statue de',
  'lăng mộ': 'Mausolee de',
  'lăng': 'Tombeau de',
  'đền thờ': 'Temple de',
  'đền': 'Temple de',
  'chùa': 'Pagode',
  'hoàng thành': 'Cite imperiale de',
  'kinh thành': 'Citadelle de',
  'thành cổ': 'Ancienne citadelle de',
  'di tích': 'Site historique de',
  'di chỉ': 'Site archeologique de',
  'bản đồ': 'Carte de',
  'chân dung': 'Portrait de',
  'phù điêu': 'Bas-relief de',
  'tranh vẽ': 'Peinture de',
  'trận': 'Bataille de',
  'chiến dịch': 'Campagne de',
  'khởi nghĩa': 'Insurrection de',
  'đại thắng': 'Grande victoire de',
  'đại phá': 'Victoire sur',
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function translateHistoricalQueryToEnglish(query: string): string {
  if (!query || !query.trim()) return '';

  let text = query.trim();

  // Sort glossary entries by descending length to match longest specific phrases first
  const sortedEntries = Object.entries(HISTORICAL_BILINGUAL_GLOSSARY).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [vietnameseKey, englishTranslation] of sortedEntries) {
    const escaped = escapeRegex(vietnameseKey);
    const regex = new RegExp(`(^|[^a-zA-Z0-9_À-ỹ])${escaped}(?=[^a-zA-Z0-9_À-ỹ]|$)`, 'gi');
    text = text.replace(regex, (_match, prefix) => `${prefix || ''}${englishTranslation}`);
  }

  // Remove any remaining Vietnamese diacritics / tones from untranslated words
  return removeVietnameseTones(text)
    .replace(/\s+/g, ' ')
    .trim();
}

export function translateHistoricalQueryToFrench(query: string): string {
  if (!query || !query.trim()) return '';

  let text = query.trim();

  // Sort glossary entries by descending length to match longest specific phrases first
  const sortedEntries = Object.entries(HISTORICAL_FRENCH_GLOSSARY).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [vietnameseKey, frenchTranslation] of sortedEntries) {
    const escaped = escapeRegex(vietnameseKey);
    const regex = new RegExp(`(^|[^a-zA-Z0-9_À-ỹ])${escaped}(?=[^a-zA-Z0-9_À-ỹ]|$)`, 'gi');
    text = text.replace(regex, (_match, prefix) => `${prefix || ''}${frenchTranslation}`);
  }

  // Remove any remaining Vietnamese diacritics / tones from untranslated words
  return removeVietnameseTones(text)
    .replace(/\s+/g, ' ')
    .trim();
}

export const DEFAULT_NEGATIVE_QUERY = '-anime -cartoon -watermark -game -3d_render -stock -fictional';

export interface FacetQueries {
  portrait?: string;
  artifact?: string;
  map?: string;
  battleOrArt?: string;
}

/**
 * Generates 4-facet visual query expansion for an image scene
 */
export function generateFacetQueries(
  primaryQuery: string,
  englishQuery?: string,
  frenchQuery?: string,
  visualType: ImageSearchVisualType = 'GENERAL_HISTORICAL',
  historicalPeriod?: string
): FacetQueries {
  const baseVi = primaryQuery.trim();
  const baseEn = (englishQuery || translateHistoricalQueryToEnglish(baseVi)).trim();
  const baseFr = (frenchQuery || translateHistoricalQueryToFrench(baseVi)).trim();
  const period = historicalPeriod ? ` ${historicalPeriod}` : '';

  return {
    portrait: `${baseVi} chân dung portrait painting${period}`,
    artifact: `${baseVi} hiện vật cổ vật di tích artifact museum${period}`,
    map: `${baseVi} bản đồ địa đồ map carte historique${period}`,
    battleOrArt: `${baseVi} tranh vẽ trận chiến relief historical art${period}`,
  };
}

/**
 * Heuristic fallback to extract meaningful search keywords from a scene's voiceover text
 */
export function extractSearchKeywordsFromText(
  voiceoverText: string,
  ragEntities: string[] = [],
  userPrompt: string = ''
): string[] {
  const cleaned = voiceoverText.replace(/[.,!?;:"'()“”‘’—…[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ').filter((w) => w.length > 2 && !VIETNAMESE_STOP_WORDS.has(w.toLowerCase()));

  const matchedEntities = ragEntities.filter((e) => {
    const lower = e.toLowerCase();
    return cleaned.toLowerCase().includes(lower);
  });
  const entityKeywords = matchedEntities.length > 0 ? matchedEntities.slice(0, 4) : ragEntities.slice(0, 2);

  const properNouns = tokens.filter((w) => /^[A-ZÀ-Ỹ]/.test(w) && !/^\d+$/.test(w));
  const years = tokens.filter((w) => /^\d{3,4}$/.test(w));

  const keywords: string[] = [];
  if (userPrompt.trim()) keywords.push(userPrompt.trim());
  keywords.push(...entityKeywords);
  keywords.push(...properNouns.slice(0, 4));
  keywords.push(...years.slice(0, 2));

  return Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).slice(0, 8);
}

/**
 * Infer visual type heuristically from voiceover text
 */
export function inferVisualTypeHeuristic(text: string): ImageSearchVisualType {
  const lower = text.toLowerCase();
  if (lower.includes('bản đồ') || lower.includes('địa bàn') || lower.includes('ranh giới') || lower.includes('lãnh thổ')) {
    return 'MAP_CHRONO';
  }
  if (lower.includes('trống đồng') || lower.includes('hiện vật') || lower.includes('vũ khí') || lower.includes('bảo vật') || lower.includes('cổ vật')) {
    return 'ARTIFACT';
  }
  if (lower.includes('khảo cổ') || lower.includes('di chỉ') || lower.includes('lăng mộ') || lower.includes('thành cổ')) {
    return 'ARCHAEOLOGY';
  }
  if (lower.includes('chân dung') || lower.includes('vua') || lower.includes('hoàng đế') || lower.includes('tướng') || lower.includes('tiểu sử')) {
    return 'PORTRAIT';
  }
  if (lower.includes('trận') || lower.includes('chiến') || lower.includes('tấn công') || lower.includes('đại phá') || lower.includes('thủy chiến')) {
    return 'BATTLE_SCENE';
  }
  if (lower.includes('sông') || lower.includes('núi') || lower.includes('phong cảnh') || lower.includes('đền') || lower.includes('chùa')) {
    return 'LANDSCAPE';
  }
  return 'GENERAL_HISTORICAL';
}

/**
 * Visual Query Formulation Agent Node:
 * Employs LLM to formulate structured ImageSearchToolInput for each scene,
 * falling back to trilingual heuristic extraction when LLM is unavailable.
 */
export async function keywordNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'keyword');
  nodeLog.info('orchestrator.keyword_extraction_started', `Extracting search keywords for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const candidateLimit = envConfig.RESEARCH_CANDIDATES_PER_SCENE || 6;
  const ragEntities = state.ragContext?.verifiedContext?.map((e) => e.canonicalName) || [];
  const aliasTerms = Object.values(state.ragContext?.aliasTable || {}).flat().slice(0, 10);
  const allContextEntities = [...ragEntities, ...aliasTerms];

  const imageScenes = state.scenes.filter((s) => s.contentType === 'IMAGE');

  // Attempt LLM structured query planning
  let llmQueriesMap: Record<string, Partial<ImageSearchToolInput>> = {};

  if (imageScenes.length > 0) {
    try {
      const scenesSummary = imageScenes
        .map((s) => `[Scene ${s.sceneId}] Voiceover: "${s.voiceoverText}"`)
        .join('\n');

      const systemPrompt = `Bạn là Trilingual Visual Research Planning Agent của ChronoViet.
Nhiệm vụ: Phân tích voiceover của từng cảnh phim lịch sử và tạo ra Search Tool Input chuẩn để tìm kiếm tư liệu ảnh lịch sử (trên Wikimedia Commons, Gallica BnF & Search Engines).
QUY TẮC BẮT BUỘC:
1. Xuất duy nhất 1 JSON object hợp lệ: { "queries": [ { "sceneId": "...", "primaryQuery": "...", "englishQuery": "...", "frenchQuery": "...", "visualType": "...", "historicalPeriod": "..." } ] }.
2. "primaryQuery": từ khóa tiếng Việt chi tiết, giàu ngữ cảnh lịch sử (ví dụ: "Tượng đài Trần Hưng Đạo bãi cọc Bạch Đằng").
3. "englishQuery": từ khóa tiếng Anh tương ứng chuẩn xác (ví dụ: "Statue of Tran Hung Dao Bach Dang battle painting").
4. "frenchQuery": từ khóa tiếng Pháp tương ứng. ƯU TIÊN dùng các thuật ngữ/địa danh lưu trữ thời thuộc địa tương ứng (ví dụ: "Tonkin", "Annam", "Cochinchine", "Indochine", "Citadelle de Hué", "Bataille de Bach Dang") để tối đa hóa khả năng truy xuất trên kho Thư viện Quốc gia Pháp (Gallica BnF).
5. "visualType": chọn 1 trong: ['PORTRAIT', 'BATTLE_SCENE', 'MAP_CHRONO', 'ARTIFACT', 'LANDSCAPE', 'ARCHAEOLOGY', 'GENERAL_HISTORICAL'].
6. Không thêm văn bản giải thích ngoài JSON.`;

      const userContent = `Chủ đề chung: "${state.userPrompt}"
Thực thể lịch sử kiểm chứng: ${ragEntities.join(', ') || 'Không có'}

Danh sách các cảnh phim:
${scenesSummary}`;

      const res = await callLlm({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        responseFormat: 'json_object',
        timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
      });

      const parsed = parseLlmJson(res.content);
      const queryList = Array.isArray(parsed) ? parsed : parsed.queries || [parsed];
      for (const item of queryList) {
        if (item?.sceneId && item?.primaryQuery) {
          llmQueriesMap[item.sceneId] = {
            sceneId: item.sceneId,
            primaryQuery: String(item.primaryQuery),
            englishQuery: item.englishQuery ? String(item.englishQuery) : undefined,
            frenchQuery: item.frenchQuery ? String(item.frenchQuery) : undefined,
            visualType: item.visualType || 'GENERAL_HISTORICAL',
            historicalPeriod: item.historicalPeriod ? String(item.historicalPeriod) : undefined,
          };
        }
      }
      nodeLog.debug('orchestrator.keyword_llm_success', `LLM formulated queries for ${Object.keys(llmQueriesMap).length} scenes`);
    } catch (err: any) {
      if (envConfig.EVAL_STRICT) {
        throw new Error(`[EVAL_STRICT] LLM visual query planning failed: ${err.message}`);
      }
      nodeLog.warn('orchestrator.keyword_llm_fallback', `LLM query planning fallback to heuristic: ${err.message}`);
    }
  }

  const updatedScenes: SceneGeneration[] = state.scenes.map((scene) => {
    if (scene.contentType !== 'IMAGE') return scene;

    const plannedQuery = llmQueriesMap[scene.sceneId];
    const rawKeywords = extractSearchKeywordsFromText(scene.voiceoverText, allContextEntities, state.userPrompt);

    if (plannedQuery && plannedQuery.primaryQuery) {
      const fallbackEnglish = translateHistoricalQueryToEnglish(plannedQuery.primaryQuery);
      const fallbackFrench = translateHistoricalQueryToFrench(plannedQuery.primaryQuery);
      const englishQuery = plannedQuery.englishQuery || fallbackEnglish;
      const frenchQuery = plannedQuery.frenchQuery || fallbackFrench;
      const visualType = plannedQuery.visualType || inferVisualTypeHeuristic(scene.voiceoverText);
      const historicalPeriod = plannedQuery.historicalPeriod || state.userPrompt;
      const facetQueries = generateFacetQueries(
        plannedQuery.primaryQuery,
        englishQuery,
        frenchQuery,
        visualType,
        historicalPeriod
      );

      const keywords = Array.from(
        new Set([
          plannedQuery.primaryQuery,
          ...(englishQuery ? [englishQuery] : []),
          ...(frenchQuery ? [frenchQuery] : []),
          ...rawKeywords,
        ])
      );
      return {
        ...scene,
        searchKeywords: keywords,
        searchParams: {
          sceneId: scene.sceneId,
          primaryQuery: plannedQuery.primaryQuery,
          englishQuery,
          frenchQuery,
          negativeQuery: DEFAULT_NEGATIVE_QUERY,
          facetQueries,
          visualType,
          historicalPeriod,
          limit: candidateLimit,
        },
      };
    }

    if (envConfig.EVAL_STRICT) {
      throw new Error(`[EVAL_STRICT] Missing planned LLM query for scene ${scene.sceneId} during evaluation`);
    }

    // Heuristic fallback
    const primaryQuery = rawKeywords.length > 0 ? rawKeywords.join(' ') : state.userPrompt;
    const englishQuery = translateHistoricalQueryToEnglish(primaryQuery);
    const frenchQuery = translateHistoricalQueryToFrench(primaryQuery);
    const visualType = inferVisualTypeHeuristic(scene.voiceoverText);
    const historicalPeriod = state.userPrompt;
    const facetQueries = generateFacetQueries(
      primaryQuery,
      englishQuery,
      frenchQuery,
      visualType,
      historicalPeriod
    );

    return {
      ...scene,
      searchKeywords: rawKeywords.length > 0 ? rawKeywords : [primaryQuery, englishQuery, frenchQuery].filter(Boolean),
      searchParams: {
        sceneId: scene.sceneId,
        primaryQuery,
        englishQuery,
        frenchQuery,
        negativeQuery: DEFAULT_NEGATIVE_QUERY,
        facetQueries,
        visualType,
        historicalPeriod,
        limit: candidateLimit,
      },
    };
  });

  return {
    status: 'KEYWORDS_EXTRACTED',
    currentStep: 6,
    scenes: updatedScenes,
  };
}
