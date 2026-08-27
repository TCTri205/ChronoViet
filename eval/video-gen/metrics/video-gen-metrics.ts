/**
 * ChronoViet Video Generation Evaluation Metrics
 * Evaluates script pacing, historical fact-checking, scene duration alignment,
 * asset download fidelity, license whitelist compliance, and VLM visual quality.
 */

import { SceneGeneration, isPureImageLayout } from '@chronoviet/shared-spec';
import { MetricScore, LatencyProfile, calculateLatencyPercentiles } from '../../shared/index.js';

export interface VideoGenTestCase {
  id: string;
  topic: string;
  epoch: string;
  targetDurationMinutes: number;
  videoType: 'BIOGRAPHY' | 'BATTLE' | 'DYNASTY' | 'MYSTERY' | 'ARTIFACT';
  templateId: string;
  expectedEntities: string[];
  expectedChapters: string[];
  searchKeywordsCheck: string[];
}

export interface VideoGenSceneSummary {
  sceneId: string;
  contentType: 'IMAGE' | 'PURE_CODE';
  layoutMode: string;
  durationSec: number;
  wordCount: number;
  hasVisualAsset: boolean;
  assetFileExists?: boolean;
  assetFileSizeBytes?: number;
  license?: string;
  licenseWhitelisted?: boolean;
  vlmHistoricalScore?: number;
  vlmVisualScore?: number;
  vlmCompositeScore?: number;
}

export interface VideoGenCaseResult {
  id: string;
  title: string;
  topic: string;
  videoType: string;
  targetDurationSec: number;
  actualDurationSec: number;
  totalWordCount: number;
  actualWpm: number;
  pacingDeviationPct: number;
  pacingPassed: boolean;
  factCheckPassed: boolean;
  factCheckFlags: string[];
  entityRecallRate: number;
  missingEntities: string[];
  keywordCoverageRate?: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  totalScenes: number;
  imageScenes: number;
  pureCodeScenes: number;
  downloadedAssetsCount: number;
  downloadSuccessRate: number;
  licenseComplianceRate: number;
  meanVlmQualityScore?: number;
  durationMs: number;
  passed: boolean;
  scenes: VideoGenSceneSummary[];
  errors?: string[];
  warnings?: string[];
}

export interface VideoGenAggregatedMetrics {
  totalProjects: number;
  passedProjects: number;
  meanPacingDeviationPct: number;
  factCheckPassRate: number;
  meanEntityRecallRate: number;
  assetDownloadSuccessRate: number;
  licenseComplianceRate: number;
  meanVlmQualityScore: number;
  pureCodeFallbackRate: number;
  durationProfile: LatencyProfile;
  metricScores: Record<string, MetricScore>;
}

export const CANONICAL_HISTORICAL_ALIASES: Record<string, string[]> = {
  'Hùng Vương': ['Vua Hùng', 'Hùng Vương', 'Hùng Quốc Vương', 'Lạc Long Quân', 'Thời đại Hùng Vương'],
  'Vua Hùng': ['Hùng Vương', 'Vua Hùng', 'Hùng Quốc Vương', 'Lạc Long Quân'],
  'Kinh Dương Vương': ['Kinh Dương Vương', 'Lộc Tục'],
  'Lạc Long Quân': ['Lạc Long Quân', 'Sùng Lãm'],
  'Phong Châu': ['Phong Châu', 'kinh đô Phong Châu', 'đất Phong Châu'],
  'Văn Lang': ['Văn Lang', 'nước Văn Lang', 'nhà nước Văn Lang'],
  'An Dương Vương': ['Thục Phán', 'Thục An Dương Vương', 'Thục Vương', 'Vua Thục', 'An Dương Vương'],
  'Thục Phán': ['An Dương Vương', 'Thục An Dương Vương', 'Thục Vương', 'Vua Thục', 'Thục Phán'],
  'Cổ Loa': ['Cổ Loa', 'thành Cổ Loa', 'Thành Cổ Loa', 'kinh đô Cổ Loa'],
  'Âu Lạc': ['Âu Lạc', 'nước Âu Lạc'],
  'Nỏ thần Kim Quy': ['Nỏ thần', 'Nỏ Kim Quy', 'Nỏ thần Liên Cơ', 'Nỏ Liên Châu', 'nỏ bắn nhiều phát', 'Nỏ thần Kim Quy', 'mũi tên đồng Cầu Vực', 'mũi tên đồng'],
  'Móng rồng Kim Quy': ['Móng rồng', 'Mũ móng rồng', 'móng rồng', 'Kim Quy', 'Móng rồng Kim Quy'],
  'Hai Bà Trưng': ['Hai Bà Trưng', 'Trưng Vương', 'Trưng Nữ Vương'],
  'Trưng Trắc': ['Trưng Trắc', 'Trưng Nữ Vương', 'Trưng Vương'],
  'Trưng Nhị': ['Trưng Nhị'],
  'Thi Sách': ['Thi Sách', 'Thi Sách bị hại'],
  'Tô Định': ['Tô Định', 'thái thú Tô Định'],
  'Mê Linh': ['Mê Linh', 'đất Mê Linh', 'kinh đô Mê Linh'],
  'Triệu Thị Trinh': ['Bà Triệu', 'Triệu Thị Trinh', 'Triệu Ẩu', 'Triệu Trinh Nương', 'Nhụy Kiều Tướng quân', 'Lệ Hải Bà Vương'],
  'Bà Triệu': ['Triệu Thị Trinh', 'Bà Triệu', 'Triệu Ẩu', 'Triệu Trinh Nương', 'Lệ Hải Bà Vương'],
  'Núi Nưa': ['Núi Nưa', 'núi Nưa', 'Bồ Điền', 'Quan Yên', 'núi Quan Yên', 'Cửu Chân'],
  'Đông Ngô': ['Đông Ngô', 'nhà Đông Ngô', 'quân Đông Ngô', 'giặc Ngô', 'nhà Ngô'],
  'Lục Dận': ['Lục Dận', 'tướng Lục Dận', 'giặc Ngô', 'quân Đông Ngô', 'nhà Đông Ngô', 'Đông Ngô'],
  'Lý Bí': ['Lý Nam Đế', 'Lý Bí', 'Lý Bôn', 'Tiền Lý'],
  'Lý Nam Đế': ['Lý Bí', 'Lý Nam Đế', 'Lý Bôn', 'Tiền Lý'],
  'Vạn Xuân': ['Vạn Xuân', 'nước Vạn Xuân', 'quốc hiệu Vạn Xuân'],
  'Chùa Khai Quốc': ['Chùa Khai Quốc', 'chùa Khai Quốc', 'Khai Quốc', 'Chùa Trấn Quốc', 'chùa Trấn Quốc', 'chùa'],
  'Tiêu Tư': ['Tiêu Tư', 'thứ sử Tiêu Tư', 'nhà Lương', 'quân Lương', 'thứ sử'],
  'Triệu Quang Phục': ['Dạ Trạch Vương', 'Triệu Việt Vương', 'Triệu Quang Phục'],
  'Dạ Trạch Vương': ['Triệu Quang Phục', 'Triệu Việt Vương', 'Dạ Trạch Vương'],
  'Đầm Dạ Trạch': ['Đầm Dạ Trạch', 'đầm Dạ Trạch', 'Dạ Trạch', 'vùng đầm Dạ Trạch'],
  'Trần Bá Tiên': ['Trần Bá Tiên', 'tướng Trần Bá Tiên', 'quân Lương', 'nhà Lương'],
  'Mai Thúc Loan': ['Mai Hắc Đế', 'Mai Thúc Loan', 'Hắc Đế', 'Mai Thúc Loan'],
  'Mai Hắc Đế': ['Mai Thúc Loan', 'Mai Hắc Đế', 'Hắc Đế'],
  'Hoan Châu': ['Hoan Châu', 'đất Hoan Châu'],
  'Thành Vạn An': ['Thành Vạn An', 'thành Vạn An', 'Vạn An'],
  'Nhà Đường': ['Nhà Đường', 'quân Đường', 'giặc Đường', 'nhà Đường', 'đô hộ Đường'],
  'Phùng Hưng': ['Bố Cái Đại Vương', 'Phùng Hưng', 'Phùng Bố Cái'],
  'Bố Cái Đại Vương': ['Phùng Hưng', 'Bố Cái Đại Vương', 'Phùng Bố Cái'],
  'Đường Lâm': ['Đường Lâm', 'đất Đường Lâm', 'làng Đường Lâm'],
  'Tống Bình': ['Tống Bình', 'thành Tống Bình', 'phủ Tống Bình'],
  'Chính Bình': ['Chính Bình', 'niên hiệu Chính Bình', 'Đại vương Chính Bình'],
  'Ngô Quyền': ['Tiền Ngô Vương', 'Ngô Quyền', 'Ngô Chúa'],
  'Bạch Đằng': ['Bạch Đằng', 'sông Bạch Đằng', 'trận Bạch Đằng', 'cọc ngầm Bạch Đằng'],
  'Nam Hán': ['Nam Hán', 'quân Nam Hán', 'nhà Nam Hán'],
  'Lưu Hoằng Thao': ['Lưu Hoằng Thao', 'Lưu Hoằng Tháo', 'Hoằng Thao', 'Hoằng Tháo'],
  'Kiều Công Tiễn': ['Kiều Công Tiễn', 'Công Tiễn'],
  'Đinh Bộ Lĩnh': ['Đinh Tiên Hoàng', 'Đinh Bộ Lĩnh', 'Vạn Thắng Vương', 'Đinh Hoàng Đế'],
  'Đinh Tiên Hoàng': ['Đinh Bộ Lĩnh', 'Đinh Tiên Hoàng', 'Vạn Thắng Vương'],
  '12 sứ quân': ['12 sứ quân', 'mười hai sứ quân', 'thập nhị sứ quân', 'loạn 12 sứ quân', 'sứ quân'],
  'Đại Cồ Việt': ['Đại Cồ Việt', 'nước Đại Cồ Việt', 'quốc hiệu Đại Cồ Việt'],
  'Kinh đô Hoa Lư': ['Kinh đô Hoa Lư', 'Hoa Lư', 'thành Hoa Lư', 'cố đô Hoa Lư'],
  'Lê Hoàn': ['Lê Đại Hành', 'Lê Hoàn', 'Vua Lê Đại Hành'],
  'Lê Đại Hành': ['Lê Hoàn', 'Lê Đại Hành', 'Vua Lê Đại Hành'],
  'Hầu Nhân Bảo': ['Hầu Nhân Bảo', 'tướng Hầu Nhân Bảo'],
  'Dương Vân Nga': ['Dương Vân Nga', 'Thái hậu Dương Vân Nga', 'Dương Thái hậu'],
  'Bạch Đằng 981': ['Bạch Đằng', 'trận Bạch Đằng', 'sông Bạch Đằng', 'Bạch Đằng 981', 'trận Bạch Đằng năm 981', 'thủy chiến Bạch Đằng 981', 'chiến thắng Bạch Đằng 981'],
  'Lý Công Uẩn': ['Lý Thái Tổ', 'Lý Công Uẩn', 'Vua Lý Thái Tổ'],
  'Lý Thái Tổ': ['Lý Công Uẩn', 'Lý Thái Tổ', 'Vua Lý Thái Tổ'],
  'Thành Đại La': ['Đại La', 'thành Đại La', 'Thành Đại La', 'Kinh đô Đại La'],
  'Thăng Long': ['Thăng Long', 'thành Thăng Long', 'kinh thành Thăng Long', 'kinh đô Thăng Long'],
  'Sư Vạn Hạnh': ['Sư Vạn Hạnh', 'thiền sư Vạn Hạnh', 'Vạn Hạnh'],
  'Chiếu dời đô': ['Thiên đô chiếu', 'Chiếu dời đô', 'chiếu dời đô', 'dời đô'],
  'Lý Thường Kiệt': ['Lý Thường Kiệt', 'Thái úy Lý Thường Kiệt'],
  'Phòng tuyến sông Như Nguyệt': ['Phòng tuyến Như Nguyệt', 'sông Như Nguyệt', 'Như Nguyệt', 'phòng tuyến Như Nguyệt'],
  'Sông Như Nguyệt': ['Sông Như Nguyệt', 'sông Như Nguyệt', 'Như Nguyệt', 'phòng tuyến Như Nguyệt'],
  'Nam quốc sơn hà': ['Nam quốc sơn hà', 'bài thơ thần Nam quốc sơn hà', 'Thơ thần', 'bài thơ thần'],
  'Quách Quỳ': ['Quách Quỳ', 'tướng Quách Quỳ'],
  'Triệu Tiết': ['Triệu Tiết', 'tướng Triệu Tiết'],
  'Tiên phát chế nhân': ['Tiên phát chế nhân', 'tiên phát chế nhân', 'chủ động tiến công', 'tiến công trước'],
  'Trần Quốc Tuấn': ['Trần Hưng Đạo', 'Hưng Đạo Đại Vương', 'Trần Quốc Tuấn', 'Đức Thánh Trần', 'Hưng Đạo Vương'],
  'Trần Hưng Đạo': ['Trần Quốc Tuấn', 'Hưng Đạo Đại Vương', 'Trần Hưng Đạo', 'Đức Thánh Trần', 'Hưng Đạo Vương'],
  'Bạch Đằng 1288': ['Bạch Đằng', 'trận Bạch Đằng', 'sông Bạch Đằng', 'Bạch Đằng 1288', 'trận Bạch Đằng năm 1288', 'thủy chiến Bạch Đằng 1288', 'chiến thắng Bạch Đằng 1288'],
  'Hịch tướng sĩ': ['Hịch tướng sĩ', 'Dụ chư tì tướng hịch văn', 'bản hịch'],
  'Hội nghị Diên Hồng': ['Hội nghị Diên Hồng', 'Diên Hồng', 'hội nghị Diên Hồng'],
  'Thoát Hoan': ['Thoát Hoan', 'Trấn Nam Vương Thoát Hoan'],
  'Ô Mã Nhi': ['Ô Mã Nhi', 'tướng Ô Mã Nhi'],
  'Toa Đô': ['Toa Đô', 'tướng Toa Đô'],
  'Lê Lợi': ['Lê Thái Tổ', 'Lê Lợi', 'Bình Định Vương', 'Vua Lê Thái Tổ'],
  'Lê Thái Tổ': ['Lê Lợi', 'Lê Thái Tổ', 'Bình Định Vương', 'Vua Lê Thái Tổ'],
  'Nguyễn Trãi': ['Ức Trai', 'Nguyễn Trãi', 'Quan phục hầu'],
  'Hội thề Lũng Nhai': ['Hội thề Lũng Nhai', 'Lũng Nhai'],
  'Bình Ngô Đại Cáo': ['Đại cáo bình Ngô', 'Bình Ngô đại cáo', 'Bình Ngô Đại Cáo', 'bình Ngô đại cáo'],
  'Trận Chi Lăng Xương Giang': ['Chi Lăng', 'Xương Giang', 'Chi Lăng - Xương Giang', 'Chi Lăng Xương Giang', 'Liễu Thăng', 'trận Chi Lăng', 'trận Xương Giang'],
  'Liễu Thăng': ['Liễu Thăng', 'tướng Liễu Thăng'],
  'Lê Thánh Tông': ['Vua Lê Thánh Tông', 'Lê Thánh Tông', 'Lê Tư Thành', 'Thánh Tông'],
  'Luật Hồng Đức': ['Luật Hồng Đức', 'Quốc triều hình luật', 'Bộ luật Hồng Đức', 'Bộ Luật Hồng Đức'],
  'Hội Tao Đàn': ['Tao Đàn nhị thập bát tú', 'Hội Tao Đàn', 'Tao Đàn'],
  'Bản đồ Hồng Đức': ['Hồng Đức bản đồ', 'Bản đồ Hồng Đức', 'bản đồ Hồng Đức'],
  'Khoa cử': ['Khoa cử', 'thi cử', 'khoa thi', 'khoa bảng', 'tiến sĩ'],
  'Quang Trung': ['Nguyễn Huệ', 'Quang Trung', 'Vua Quang Trung', 'Bắc Bình Vương'],
  'Nguyễn Huệ': ['Quang Trung', 'Nguyễn Huệ', 'Vua Quang Trung', 'Bắc Bình Vương'],
  'Ngọc Hồi': ['Ngọc Hồi', 'đồn Ngọc Hồi'],
  'Đống Đa': ['Đống Đa', 'gò Đống Đa', 'trận Đống Đa'],
  'Tôn Sĩ Nghị': ['Tôn Sĩ Nghị', 'Tổng đốc Tôn Sĩ Nghị'],
  'Sầm Nghi Đống': ['Sầm Nghi Đống', 'Thái thú Sầm Nghi Đống', 'Điền châu tri phủ Sầm Nghi Đống'],
  'Voi chiến': ['Voi chiến', 'voi chiến', 'đội tượng binh', 'tượng binh', 'cưỡi voi'],
  'Trương Định': ['Bình Tây Đại Nguyên Soái', 'Trương Định', 'Trương Công Định'],
  'Bình Tây Đại Nguyên Soái': ['Trương Định', 'Bình Tây Đại Nguyên Soái', 'Trương Công Định'],
  'Gò Công': ['Gò Công', 'căn cứ Gò Công'],
  'Tân Hòa': ['Tân Hòa', 'đất Tân Hòa'],
  'Kháng chiến Nam Kỳ': ['Kháng chiến Nam Kỳ', 'kháng chiến Nam Kỳ', 'chống Pháp ở Nam Kỳ', 'Nam Kỳ'],
  'Phan Đình Phùng': ['Đình nguyên Phan Đình Phùng', 'Phan Đình Phùng', 'Cụ Phan'],
  'Cao Thắng': ['Cao Thắng', 'tướng Cao Thắng'],
  'Hương Khê': ['Hương Khê', 'khởi nghĩa Hương Khê'],
  'Cần Vương': ['Cần Vương', 'phong trào Cần Vương', 'chiếu Cần Vương'],
  'Vụ Quang': ['Vụ Quang', 'căn cứ Vụ Quang'],
  'Súng trường kiểu Pháp': ['Súng trường kiểu Pháp', 'súng trường kiểu Pháp', 'súng kiểu Pháp', 'súng trường 1874', 'súng trường', 'chế tạo súng trường', 'súng Pháp'],
  'Võ Nguyên Giáp': ['Đại tướng Võ Nguyên Giáp', 'Võ Nguyên Giáp', 'Tướng Giáp'],
  'Điện Biên Phủ': ['Điện Biên Phủ', 'chiến dịch Điện Biên Phủ', 'trận Điện Biên Phủ', 'Mường Thanh', 'Chiến dịch Điện Biên Phủ'],
  'Đờ Cát': ['Đờ Cát', 'De Castries', 'tướng Đờ Cát', 'Đờ Cát-xtri', 'Tướng De Castries', 'Christian de Castries'],
  'Tướng De Castries': ['Đờ Cát', 'De Castries', 'tướng Đờ Cát', 'Đờ Cát-xtri', 'Tướng De Castries', 'Christian de Castries'],
  'Đồi A1': ['Đồi A1', 'đồi A1', 'cứ điểm A1', 'A1', 'đồi Eliane'],
  'Him Lam': ['Him Lam', 'cứ điểm Him Lam'],
  'Mường Thanh': ['Mường Thanh', 'cánh đồng Mường Thanh', 'sân bay Mường Thanh'],
  'Kéo pháo': ['Kéo pháo', 'kéo pháo', 'hò kéo pháo', 'đưa pháo vào trận địa', 'kéo pháo vào kéo pháo ra'],
  'Kéo pháo vào kéo pháo ra': ['Kéo pháo', 'kéo pháo', 'hò kéo pháo', 'đưa pháo vào trận địa', 'kéo pháo vào kéo pháo ra', 'kéo pháo vào'],
  'Hiệp định Genève': ['Hiệp định Genève', 'Hiệp định Giơ-ne-vơ', 'Giơ-ne-vơ', 'Genève', 'hội nghị Genève'],
  'Hồ Chí Minh': ['Nguyễn Ái Quốc', 'Bác Hồ', 'Hồ Chí Minh', 'Nguyễn Sinh Cung', 'Nguyễn Tất Thành'],
  'Gia Long': ['Nguyễn Ánh', 'Vua Gia Long', 'Gia Long', 'Thế Tổ Cao Hoàng Đế'],
  'Nguyễn Ánh': ['Gia Long', 'Vua Gia Long', 'Nguyễn Ánh'],
  'Minh Mạng': ['Minh Mệnh', 'Vua Minh Mạng', 'Minh Mạng', 'Thánh Tổ'],
  'Tự Đức': ['Vua Tự Đức', 'Tự Đức', 'Dực Tông'],
  'Hàm Nghi': ['Vua Hàm Nghi', 'Hàm Nghi'],
  'Bảo Đại': ['Vua Bảo Đại', 'Bảo Đại', 'Nguyễn Phúc Vĩnh Thụy'],
};

export function evaluateVideoGenCase(
  testCase: VideoGenTestCase,
  projectState: {
    projectId: string;
    scriptText: string;
    scenes: SceneGeneration[];
    factCheckPassed: boolean;
    factCheckFlags?: string[];
    aliasTable?: Record<string, string[]>;
    executionDurationMs: number;
  },
  sceneSummaries: VideoGenSceneSummary[]
): VideoGenCaseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const targetDurationSec = testCase.targetDurationMinutes * 60;
  const actualDurationSec = sceneSummaries.reduce((sum, s) => sum + s.durationSec, 0);

  // Word count & Pacing
  const words = projectState.scriptText.trim().split(/\s+/).filter(Boolean);
  const totalWordCount = words.length;
  const durationMin = actualDurationSec > 0 ? actualDurationSec / 60 : testCase.targetDurationMinutes;
  const actualWpm = durationMin > 0 ? Math.round(totalWordCount / durationMin) : 0;

  // Target WPM is 145 (range 130 - 160)
  const targetWpm = 145;
  const pacingDeviationPct = Math.round((Math.abs(actualWpm - targetWpm) / targetWpm) * 1000) / 10;
  // Pacing pass if within 15% deviation
  const pacingPassed = pacingDeviationPct <= 15.0;
  if (!pacingPassed) {
    warnings.push(`Pacing deviation is ${pacingDeviationPct}% (WPM=${actualWpm}, Target=${targetWpm})`);
  }

  // Fact check
  const factCheckPassed = projectState.factCheckPassed;
  if (!factCheckPassed) {
    errors.push(`Historical fact-check flag raised: ${(projectState.factCheckFlags || []).join(', ')}`);
  }

  // Canonical & Alias-Aware Entity Recall Check
  const expectedEntities = testCase.expectedEntities || [];
  const scriptLower = projectState.scriptText.toLowerCase();

  const matchedEntities: string[] = [];
  const missingEntities: string[] = [];

  for (const ent of expectedEntities) {
    const entTrimmed = ent.trim();
    if (!entTrimmed) continue;
    const entLower = entTrimmed.toLowerCase();

    // Collect all valid variants from RAG aliasTable and static historical dictionary
    const ragAliases = (projectState.aliasTable?.[entTrimmed] || []).map((a) => a.trim());
    const staticAliases = (CANONICAL_HISTORICAL_ALIASES[entTrimmed] || []).map((a) => a.trim());

    // Single-level reverse alias lookup for canonical mapping
    const reverseAliases: string[] = [];
    for (const [canonicalKey, aliases] of Object.entries(CANONICAL_HISTORICAL_ALIASES)) {
      if (aliases.some((a) => a.toLowerCase() === entLower) && canonicalKey.toLowerCase() !== entLower) {
        reverseAliases.push(canonicalKey);
      }
    }

    const allVariants = Array.from(
      new Set([entTrimmed, ...ragAliases, ...staticAliases, ...reverseAliases])
    );

    const isMatched = allVariants.some((variant) => {
      const vTrimmed = variant.trim();
      if (!vTrimmed || vTrimmed.length < 2) return false;
      return scriptLower.includes(vTrimmed.toLowerCase());
    });

    if (isMatched) {
      matchedEntities.push(entTrimmed);
    } else {
      missingEntities.push(entTrimmed);
    }
  }

  const entityRecallRate = expectedEntities.length > 0 ? matchedEntities.length / expectedEntities.length : 1.0;

  if (entityRecallRate < 0.60 && missingEntities.length > 0) {
    warnings.push(
      `Historical entity recall is ${(entityRecallRate * 100).toFixed(0)}% (Missing: ${missingEntities.join(', ')})`
    );
  }

  // Search Keyword Research Assertions
  const expectedKeywords = testCase.searchKeywordsCheck || [];
  const allSceneQueries = (projectState.scenes || [])
    .map((s) => `${s.searchParams?.primaryQuery || ''} ${(s.searchKeywords || []).join(' ')}`)
    .join(' ')
    .normalize('NFC')
    .toLowerCase();

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of expectedKeywords) {
    const normKw = kw.normalize('NFC').trim().toLowerCase();
    if (!normKw) continue;
    if (allSceneQueries.includes(normKw)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const keywordCoverageRate = expectedKeywords.length > 0
    ? Math.round((matchedKeywords.length / expectedKeywords.length) * 1000) / 1000
    : 1.0;

  if (keywordCoverageRate < 0.50 && missingKeywords.length > 0) {
    warnings.push(`Search keyword coverage is ${(keywordCoverageRate * 100).toFixed(0)}% (Uncovered queries: ${missingKeywords.join(', ')})`);
  }

  // Scenes & Assets
  const totalScenes = sceneSummaries.length;
  const imageScenes = sceneSummaries.filter((s) => s.contentType === 'IMAGE').length;
  const pureCodeScenes = sceneSummaries.filter((s) => s.contentType === 'PURE_CODE').length;

  const validDownloads = sceneSummaries.filter((s) => s.contentType === 'IMAGE' && s.assetFileExists && (s.assetFileSizeBytes || 0) > 0).length;
  const downloadSuccessRate = imageScenes > 0 ? validDownloads / imageScenes : 1.0;

  const whitelistedCount = sceneSummaries.filter((s) => {
    if (s.contentType !== 'IMAGE') return true;
    return s.licenseWhitelisted === true;
  }).length;
  const licenseComplianceRate = totalScenes > 0 ? whitelistedCount / totalScenes : 1.0;

  if (licenseComplianceRate < 1.0) {
    errors.push(`License compliance violation detected (${(licenseComplianceRate * 100).toFixed(1)}%)`);
  }

  // PURE_CODE Layout Compatibility Check (pure code scenes must NOT retain image-dependent layouts)
  for (const s of sceneSummaries) {
    if (s.contentType === 'PURE_CODE' && isPureImageLayout(s.layoutMode)) {
      errors.push(`PURE_CODE scene ${s.sceneId} retains image-dependent layout ${s.layoutMode}`);
    }
  }

  const vlmScores = sceneSummaries
    .map((s) => s.vlmCompositeScore)
    .filter((score): score is number => typeof score === 'number' && score > 0);
  let meanVlmQualityScore: number | undefined;
  if (vlmScores.length > 0) {
    meanVlmQualityScore = Math.round((vlmScores.reduce((a, b) => a + b, 0) / vlmScores.length) * 10) / 10;
  } else if (imageScenes > 0) {
    meanVlmQualityScore = 0.0;
    errors.push(`Visual scenes present (${imageScenes}) but 0 candidates evaluated by VLM`);
  } else {
    // imageScenes === 0: Pure code composition, VLM score is N/A
    meanVlmQualityScore = undefined;
  }

  const passed = errors.length === 0;

  return {
    id: testCase.id,
    title: testCase.topic,
    topic: testCase.topic,
    videoType: testCase.videoType,
    targetDurationSec,
    actualDurationSec,
    totalWordCount,
    actualWpm,
    pacingDeviationPct,
    pacingPassed,
    factCheckPassed,
    factCheckFlags: projectState.factCheckFlags || [],
    entityRecallRate,
    missingEntities,
    keywordCoverageRate,
    matchedKeywords,
    missingKeywords,
    totalScenes,
    imageScenes,
    pureCodeScenes,
    downloadedAssetsCount: validDownloads,
    downloadSuccessRate,
    licenseComplianceRate,
    meanVlmQualityScore,
    durationMs: projectState.executionDurationMs,
    passed,
    scenes: sceneSummaries,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function computeVideoGenAggregatedMetrics(
  caseResults: VideoGenCaseResult[]
): VideoGenAggregatedMetrics {
  const totalProjects = caseResults.length;
  const passedProjects = caseResults.filter((r) => r.passed).length;

  const meanPacingDeviation = totalProjects > 0
    ? caseResults.reduce((sum, r) => sum + r.pacingDeviationPct, 0) / totalProjects
    : 0;

  const factPasses = caseResults.filter((r) => r.factCheckPassed).length;
  const factCheckPassRate = totalProjects > 0 ? factPasses / totalProjects : 1.0;

  const meanEntityRecall = totalProjects > 0
    ? caseResults.reduce((sum, r) => sum + (r.entityRecallRate || 0), 0) / totalProjects
    : 1.0;

  const totalImageScenes = caseResults.reduce((sum, r) => sum + r.imageScenes, 0);
  const totalDownloads = caseResults.reduce((sum, r) => sum + r.downloadedAssetsCount, 0);
  const assetDownloadSuccessRate = totalImageScenes > 0 ? totalDownloads / totalImageScenes : 1.0;

  const totalScenesAll = caseResults.reduce((sum, r) => sum + r.totalScenes, 0);
  const totalPureCode = caseResults.reduce((sum, r) => sum + r.pureCodeScenes, 0);
  const pureCodeFallbackRate = totalScenesAll > 0 ? totalPureCode / totalScenesAll : 0;

  const meanLicenseCompliance = totalProjects > 0
    ? caseResults.reduce((sum, r) => sum + r.licenseComplianceRate, 0) / totalProjects
    : 1.0;

  const casesWithImageScenes = caseResults.filter((r) => r.imageScenes > 0);
  const casesWithVlm = caseResults.filter(
    (r) => r.imageScenes > 0 && typeof r.meanVlmQualityScore === 'number' && r.meanVlmQualityScore > 0
  );
  const meanVlmScore = casesWithVlm.length > 0
    ? casesWithVlm.reduce((sum, r) => sum + (r.meanVlmQualityScore || 0), 0) / casesWithVlm.length
    : 0;

  const allDurations = caseResults.map((r) => r.durationMs);
  const durationProfile = calculateLatencyPercentiles(allDurations);

  const metricScores: Record<string, MetricScore> = {
    scriptPacingDeviation: {
      name: 'Script Pacing Deviation',
      value: Math.round(meanPacingDeviation * 10) / 10,
      target: 8.0,
      pass: meanPacingDeviation <= 15.0, // Target <= 8%, fail > 15%
      unit: '%',
      description: 'Deviation of spoken narration WPM against target 130-160 WPM benchmark',
    },
    factCheckPassRate: {
      name: 'Historical Fact-Check Pass Rate',
      value: Math.round(factCheckPassRate * 1000) / 10,
      target: 95.0,
      pass: factCheckPassRate >= 0.90, // Target >= 95%, fail < 90%
      unit: '%',
      description: 'Percentage of video scripts passing multi-tier historical fact-check and guardrails',
    },
    historicalEntityRecall: {
      name: 'Historical Entity Recall Rate',
      value: Math.round(meanEntityRecall * 1000) / 10,
      target: 80.0,
      pass: meanEntityRecall >= 0.65, // Target >= 80%, soft pass >= 65%
      unit: '%',
      description: 'Percentage of expected canonical historical entities covered in the generated voiceover script',
    },
    assetDownloadSuccessRate: {
      name: 'Image Asset Download Success Rate',
      value: Math.round(assetDownloadSuccessRate * 1000) / 10,
      target: 80.0,
      pass: assetDownloadSuccessRate >= 0.65, // Target >= 80%, fail < 65%
      unit: '%',
      description: 'Percentage of visual candidates successfully downloaded, decoded and saved to disk',
    },
    licenseComplianceRate: {
      name: 'License Whitelist Compliance Rate',
      value: Math.round(meanLicenseCompliance * 1000) / 10,
      target: 100.0,
      pass: meanLicenseCompliance >= 1.0, // Target 100%, strict gate
      unit: '%',
      description: 'Percentage of selected image assets matching CC0 / CC-BY / Public Domain licenses',
    },
    vlmQualityScore: {
      name: 'VLM Visual Quality Score',
      value: Math.round(meanVlmScore * 10) / 10,
      target: 7.5,
      pass: casesWithImageScenes.length > 0 ? meanVlmScore >= 6.5 : true, // Target >= 7.5 / 10, fail < 6.5
      unit: '/10',
      description: 'Mean historical relevance and visual aesthetic score rated by VLM inspector',
    },
  };

  return {
    totalProjects,
    passedProjects,
    meanPacingDeviationPct: Math.round(meanPacingDeviation * 10) / 10,
    factCheckPassRate,
    meanEntityRecallRate: Math.round(meanEntityRecall * 1000) / 1000,
    assetDownloadSuccessRate,
    licenseComplianceRate: meanLicenseCompliance,
    meanVlmQualityScore: Math.round(meanVlmScore * 10) / 10,
    pureCodeFallbackRate,
    durationProfile,
    metricScores,
  };
}
