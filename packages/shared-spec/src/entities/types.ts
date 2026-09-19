/**
 * Entity Types & Metadata Interfaces
 */

export interface HistoricalPeriodAlias {
  period: string; // e.g. "1901 (khi đi học)", "1911 (khi tìm đường cứu nước)", "1919 - 1941 (hoạt động quốc tế)"
  name: string;   // e.g. "Nguyễn Tất Thành", "Văn Ba", "Nguyễn Ái Quốc"
  context?: string;
}

export interface HistoricalPersonFamilyLineage {
  father?: string;
  mother?: string;
  siblings?: string[];
  spouses?: string[];
  children?: string[];
}

export interface HistoricalMisconception {
  id: string;
  triggerKeywords: string[];
  explanation: string;
  relatedEntityIds?: string[];
}

export interface HistoricalPersonNamingMetadata {
  archetype?: 'FEUDAL_FIGURE' | 'MODERN_FIGURE';
  birthName?: string;            // e.g. "Hồ Thơm", "Lý Công Uẩn", "Nguyễn Sinh Cung"
  courtesyOrCommonName?: string; // e.g. "Nguyễn Huệ", "Bác Hồ"
  preReignTitles?: string[];     // e.g. ["Long Nhương Tướng Quân", "Bắc Bình Vương"]
  reignEra?: string;             // e.g. "Quang Trung", "Thuận Thiên"
  reignPeriod?: { start: number; end: number }; // e.g. { start: 1788, end: 1792 }
  templeName?: string;           // e.g. "Lý Thái Tổ", "Đinh Tiên Hoàng"
  posthumousName?: string;       // e.g. "Vũ Hoàng Đế"
  periodAliases?: HistoricalPeriodAlias[]; // e.g. for modern figures: Nguyen Tat Thanh, Van Ba, Nguyen Ai Quoc, Ho Chi Minh
  familyLineage?: HistoricalPersonFamilyLineage; // e.g. parents, siblings, spouses, children recorded in official annals
  totalAliasesEstimated?: string; // e.g. estimated total number of names/pseudonyms recorded by historians/official institutions
  misconceptions?: HistoricalMisconception[]; // Historical anecdotes, folklore traps or common confusions recorded centrally
  famousQuote?: string; // Authoritative famous quotes recorded in primary historical annals
  achievements?: string[]; // Major contributions, reforms, works, or milestones recorded in annals
  adversaries?: string[]; // Canonical historical adversaries or invading enemy commanders
}

export interface HistoricalDocMetadata {
  author?: string;
  dynasty?: string;
  year?: number;
  adversary?: string;
  context?: string;
}

export interface HistoricalEntityInfo {
  entityId: string;
  canonicalName: string;
  type: 'HISTORICAL_PERSON' | 'LOCATION' | 'EVENT_BATTLE' | 'DYNASTY_ERA' | 'ORGANIZATION' | 'ARTIFACT' | 'DOCUMENT_CULTURE' | string;
  aliases: string[];
  timeRange?: { start?: number; end?: number };
  dynasty?: string;
  isMythological?: boolean;
  role?: 'HERO' | 'MONARCH' | 'GENERAL' | 'SCHOLAR' | 'ADVERSARY' | 'OTHER' | string;
  misconceptions?: HistoricalMisconception[];
  namingMetadata?: HistoricalPersonNamingMetadata;
  docMetadata?: HistoricalDocMetadata;
}

export interface AdministrativeHierarchy {
  canonicalName: string;
  unitType: 'VILLAGE' | 'COMMUNE' | 'DISTRICT' | 'PROVINCE' | 'ANCIENT_CAPITAL' | 'REGION' | 'FORTRESS_OR_BATTLEFIELD';
  parentNames?: string[];
  modernProvince?: string;
  ancientNames?: string[];
  aliases?: string[];
}

export interface AdministrativeContainmentResult {
  valid: boolean;
  childName?: string;
  claimedParentName?: string;
  actualProvince?: string;
  actualParents?: string[];
  reason?: string;
  suggestedCorrection?: string;
}
