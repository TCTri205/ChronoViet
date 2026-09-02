/**
 * Foreign Invading Dynasties, Commanders, Military Forces & Landmark Mappings
 */

export const FOREIGN_DYNASTIES_SET = new Set([
  'dynasty_nam_han',
  'dynasty_tong',
  'dynasty_nha_tong',
  'dynasty_minh',
  'dynasty_nha_minh',
  'dynasty_thanh',
  'dynasty_nha_thanh',
  'dynasty_nguyen_mong',
  'dynasty_quan_nguyen',
  'dynasty_xiem_la',
  'dynasty_dong_han',
  'dynasty_nha_dong_han',
  'dynasty_dong_ngo',
  'dynasty_trieu_tien',
  'dynasty_nha_duong',
  'dynasty_trieu_da',
  'dynasty_nha_trieu',
  'dynasty_bac_thuoc',
  'dynasty_thoi_ky_bac_thuoc',
  'dynasty_phap_thuoc',
  'epoch_bac_thuoc_1',
  'epoch_bac_thuoc_2',
  'epoch_bac_thuoc_3',
]);

export const FOREIGN_COMMANDERS_SET = new Set([
  'person_ton_si_nghi',
  'person_thoat_hoan',
  'person_o_ma_nhi',
  'person_lieu_thang',
  'person_truong_phu',
  'person_quach_quy',
  'person_trieu_da',
  'person_to_dinh',
  'person_ma_vien',
  'person_sam_nghi_dong',
  'person_nguyen_ham',
  'person_sai_phu',
  'person_luu_hoang_thao',
  'person_hoang_thao',
  'person_toa_do',
  'person_van_mang',
  'person_trieu_tiet',
  'person_luc_khanh',
  'person_tich_quang',
]);

export const FOREIGN_INVADING_FORCES_SET = new Set([
  'org_quan_thanh',
  'org_quan_nha_thanh',
  'org_quan_man_thanh',
  'org_quan_xuan_thanh',
  'org_quan_minh',
  'org_quan_nha_minh',
  'org_quan_nguyen_mong',
  'org_quan_mong_co',
  'org_quan_nguyen',
  'org_quan_nam_han',
  'org_quan_dong_han',
  'org_quan_dong_ngo',
  'org_quan_nha_duong',
  'org_quan_tong',
  'org_quan_nha_tong',
  'org_quan_phap',
  'org_quan_my',
  'org_quan_xiem',
  'org_quan_trieu_da',
  'org_quan_an',
  'org_quan_sam_nghi_dong',
  'org_quan_ton_si_nghi',
  'org_quan_o_ma_nhi',
  'org_quan_thoat_hoan',
  'org_quan_lieu_thang',
  'org_quan_to_dinh',
  'org_quan_ma_vien',
]);

export function isForeignInvadingForce(id: string): boolean {
  if (!id) return false;
  const lower = id.toLowerCase();
  if (FOREIGN_INVADING_FORCES_SET.has(lower)) return true;
  if (
    lower.startsWith('org_quan_thanh') ||
    lower.startsWith('org_quan_man_thanh') ||
    lower.startsWith('org_quan_minh') ||
    lower.startsWith('org_quan_mong') ||
    lower.startsWith('org_quan_nguyen_mong') ||
    lower.startsWith('org_quan_nam_han') ||
    lower.startsWith('org_quan_dong_han') ||
    lower.startsWith('org_quan_tong') ||
    lower.startsWith('org_quan_xiem') ||
    lower.startsWith('org_quan_phap') ||
    lower.startsWith('org_quan_my') ||
    lower.startsWith('org_quan_nha_') ||
    lower.startsWith('org_giac_') ||
    lower.startsWith('org_quan_xam_luoc')
  ) {
    return true;
  }
  return false;
}

export const VIETNAMESE_LANDMARK_PARENT_MAP: Record<string, string> = {
  'loc_thanh_co_loa': 'loc_dong_anh',
  'loc_co_loa': 'loc_dong_anh',
  'loc_dong_anh': 'loc_thang_long',
  'loc_dinh_doc_lap': 'loc_sai_gon',
  'loc_thuy_dien_hoa_binh': 'loc_hoa_binh',
  'loc_can_cu_vu_quang': 'loc_ha_tinh',
  'loc_vu_quang': 'loc_ha_tinh',
  'loc_can_cu_phu_dien': 'loc_thanh_hoa',
  'loc_phu_dien': 'loc_thanh_hoa',
  'loc_nui_nua': 'loc_thanh_hoa',
  'loc_nong_cong': 'loc_thanh_hoa',
  'loc_vinh_loc': 'loc_thanh_hoa',
  'loc_tho_xuan': 'loc_thanh_hoa',
  'loc_lam_son': 'loc_thanh_hoa',
  'loc_phong_khe': 'loc_dong_anh',
  'loc_nui_ban': 'loc_thua_thien_hue',
  'loc_muong_phang': 'loc_dien_bien',
  'loc_dien_bien_phu': 'loc_dien_bien',
  'loc_thanh_tay_do': 'loc_thanh_hoa',
  'loc_thanh_nha_ho': 'loc_thanh_hoa',
  'loc_nui_soc_son': 'loc_soc_son',
  'loc_soc_son': 'loc_thang_long',
  'loc_duong_lam': 'loc_son_tay',
  'loc_van_mieu': 'loc_thang_long',
  'loc_chua_mot_cot': 'loc_thang_long',
  'loc_hoang_thanh_thang_long': 'loc_thang_long',
  'loc_ben_nha_rong': 'loc_sai_gon',
  'loc_nha_rong': 'loc_sai_gon',
  'loc_phu_xuan': 'loc_thua_thien_hue',
  'loc_chi_linh': 'loc_hai_duong',
  'loc_chi_lang': 'loc_lang_son',
  'loc_xuong_giang': 'loc_bac_giang',
  'loc_tan_trao': 'loc_tuyen_quang',
  'loc_ngoc_hoi': 'loc_thang_long',
  'loc_dong_da': 'loc_thang_long',
};
