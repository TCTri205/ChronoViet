/**
 * Generic 5-Level Administrative & Spatial Hierarchy Classifier
 * Level 4: Macro Region / Nation / Realm (Đại Việt, Đàng Trong, Bắc Kỳ...)
 * Level 3: Province / Central City / Feudal Capital / Prefecture (Hà Nội, Thanh Hóa, Thăng Long...)
 * Level 2: District / County / Town (Đông Anh, Nông Cống, Chi Lăng...)
 * Level 1: Village / Commune / Hamlet (Phú Điền, làng...)
 * Level 0: Specific Site / Monument / Fortress / Temple / River (thành Cổ Loa, đền Hùng...)
 */
export function getSpatialHierarchyLevel(name: string, id: string): number {
  const norm = name.toLowerCase().trim();
  // Level 4: Macro Region / Realm / State / Country
  if (/(?:^|\s)(việt\s+nam|đại\s+việt|đại\s+nam|đàng\s+trong|đàng\s+ngoài|bắc\s+kỳ|trung\s+kỳ|nam\s+kỳ|xứ\s+đoài|xứ\s+kinh\s+bắc|xứ\s+sơn\s+nam|kinh\s+bắc|sơn\s+nam|bắc\s+hà|nam\s+hà|nam\s+bộ|bắc\s+bộ|trung\s+bộ|tây\s+nguyên|miền\s+nam|miền\s+bắc|miền\s+trung|giao\s+châu|hoan\s+châu|ái\s+châu)(?:$|\s)/i.test(norm)) {
    return 4;
  }
  // Level 3: Province / Central City / Feudal Capital / Prefecture / Circuit
  if (/(?:^|\s)(tỉnh|thành\s+phố|kinh\s+đô|kinh\s+thành|hoàng\s+thành|thăng\s+long|hà\s+nội|sài\s+gòn|gia\s+định|huế|phú\s+xuân|đông\s+kinh|đông\s+quan|đại\s+la|tống\s+bình|hoa\s+lư|phủ|trấn|châu)(?:$|\s)/i.test(norm) || /^(?:loc_ha_noi|loc_thang_long|loc_thanh_hoa|loc_lang_son|loc_quang_ninh|loc_sai_gon|loc_hue|loc_tien_giang|loc_can_tho|loc_nghe_an|loc_hai_duong|loc_bac_ninh|loc_ninh_binh|loc_quang_nam|loc_da_nang)$/.test(id)) {
    return 3;
  }
  // Level 2: District / Town / County
  if (/(?:^|\s)(huyện|quận|thị\s+xã)(?:$|\s)/i.test(norm)) {
    return 2;
  }
  // Level 1: Village / Commune / Ward / Hamlet
  if (/(?:^|\s)(xã|phường|thị\s+trấn|làng|thôn|ấp|bản|mường)(?:$|\s)/i.test(norm)) {
    return 1;
  }
  // Level 0: Specific Site / Monument / Fortress / Temple / Mountain / River / Island
  return 0;
}
