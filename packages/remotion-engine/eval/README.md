# Remotion Render Engine Evaluation Suite (`packages/remotion-engine/eval/`)

## 📌 Overview
Bộ công cụ đánh giá chuyên biệt dành cho **Remotion Render Engine** (31 LayoutModes, 19 TransitionTypes, 100% Data-Driven Render Pipeline).

Bộ đánh giá hoạt động theo 3 giai đoạn:
1. **Phase 1: Programmatic Automated Metrics Evaluation**: Kiểm định hợp lệ Zod JSON Schema v4.1, tính toán thời lượng tổng theo khung hình (`calculatedTotalFrames`), thống kê số lượng phân cảnh (`totalScenes`), đo lường độ bao phủ các `layoutModes` và `transitions`.
2. **Phase 2: Artifact Integrity & Zero Image Capture Policy**: Đảm bảo tuyệt đối **không chụp/sinh file ảnh tĩnh vào thư mục `eval/out`** (Zero Image Capture Policy), giữ thư mục dự án hoàn toàn sạch sẽ.
3. **Phase 3: Launch Remotion Studio for Human Evaluation**: Tự động mở giao diện trực quan **Remotion Studio** (`http://localhost:9876`) để người dùng (Human) xem kết quả video thực tế, tương tác kéo tua timeline, kiểm tra âm thanh và hiệu ứng visual.

---

## 📊 Core Metrics & Targets (KPI)
- **Schema Validation Pass Rate**: $100\%$ (Mọi file JSON kịch bản phải khớp Zod Schema từ `@chronoviet/shared-spec`).
- **Layout Coverage Rate**: $31 / 31$ Layout Modes (18 Core + 13 Extended).
- **Transition Coverage Rate**: $19 / 19$ Transition Types.
- **Zero Image Artifact Policy**: $0$ file ảnh thừa sinh ra trong `eval/out`.

---

## 📁 Directory Structure & 8 Standardized Test Cases
```text
eval/
├── README.md         # Tài liệu hướng dẫn đánh giá này
├── test-cases/       # 8 Kịch bản JSON v4.1 mẫu phủ 31 LayoutModes & 19 Transitions:
│   ├── artifact_trong_dong_ngoc_lu.json  (Domain: ARTIFACT)
│   ├── battle_bach_dang_938.json         (Domain: BATTLE)
│   ├── battle_hai_ba_trung.json          (Domain: BATTLE)
│   ├── battle_mongol_viet_2.json         (Domain: BATTLE)
│   ├── biography_quang_trung.json        (Domain: BIOGRAPHY)
│   ├── biography_tran_hung_dao.json      (Domain: BIOGRAPHY)
│   ├── dynasty_nha_ly.json               (Domain: DYNASTY)
│   └── mystery_le_chi_vien.json          (Domain: MYSTERY)
├── reports/          # Báo cáo kết quả kiểm định (JSON / Markdown)
├── public/           # Mock Static Assets cho Studio Preview (`eval/public/assets`)
├── scripts/          # Scripts khởi tạo mock assets (setup_assets.js)
├── out/              # Thư mục output sạch (Không chứa ảnh dư thừa)
└── runner.ts         # Script kiểm định tự động
```

---

## 🚀 How to Run Evaluation (Tất cả lệnh chạy từ Root Monorepo)

### 1. Lệnh cơ bản (Chạy từ Root Monorepo)
```bash
# 1. Chạy suite eval tự động ở chế độ CI headless:
pnpm eval:remotion
# hoặc:
pnpm --filter @chronoviet/remotion-engine eval

# 2. Khởi tạo mock assets cho Studio & Eval:
pnpm --filter @chronoviet/remotion-engine setup-assets

# 3. Mở giao diện tương tác Remotion Studio GUI (Port 9876):
pnpm remotion:studio

# 4. Chạy với vòng đời dọn dẹp sạch sẽ trước khi đánh giá:
pnpm --filter @chronoviet/remotion-engine eval -- --fresh

# 5. Chỉ chạy dọn dẹp artifact rác:
pnpm --filter @chronoviet/remotion-engine eval -- --clean
```

### 2. Tham Số CLI cho `eval/runner.ts`:
| Tham số | Viết tắt | Mô tả | Mặc định |
| :--- | :--- | :--- | :--- |
| `--testCasesDir` | `-t` | Thư mục chứa các file JSON test cases | `eval/test-cases` |
| `--outDir` | `-o` | Thư mục output (giữ sạch) | `eval/out` |
| `--reportsDir` | `-r` | Thư mục lưu báo cáo kiểm định Markdown/JSON | `eval/reports` |
| `--no-studio` / `--ci` | - | Tắt tự động mở Remotion Studio GUI | `false` |
| `--clean` | - | Chỉ dọn dẹp toàn bộ audio rác, báo cáo cũ & port rồi thoát | `false` |
| `--fresh` | - | Thực thi dọn dẹp sạch trước khi tiến hành eval | `false` |
