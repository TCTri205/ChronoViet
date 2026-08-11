# Remotion Render Engine Evaluation Suite (`packages/remotion-engine/eval/`)

## 📌 Overview
Bộ công cụ đánh giá chuyên biệt dành cho **Remotion Render Engine** (31 LayoutModes, 19 TransitionTypes, 100% Data-Driven Render Pipeline).

Bộ đánh giá hoạt động theo 3 giai đoạn:
1. **Phase 1: Programmatic Automated Metrics Evaluation**: Kiểm định hợp lệ Zod JSON Schema v3.0 / v3.2, tính toán thời lượng tổng theo khung hình (`calculatedTotalFrames`), thống kê số lượng phân cảnh (`totalScenes`), đo lường độ bao phủ các `layoutModes` và `transitions`.
2. **Phase 2: Artifact Integrity & Zero Image Capture Policy**: Đảm bảo tuyệt đối **không chụp/sinh file ảnh tĩnh vào thư mục `eval/out`** (Zero Image Capture Policy), giữ thư mục dự án hoàn toàn sạch sẽ.
3. **Phase 3: Launch Remotion Studio for Human Evaluation**: Tự động mở giao diện trực quan **Remotion Studio** (`http://localhost:9876`) để người dùng (Human) xem kết quả video thực tế, tương tác kéo tua timeline, kiểm tra âm thanh và hiệu ứng visual.

---

## 📊 Core Metrics & Targets (KPI)
- **Schema Validation Pass Rate**: $100\%$ (Mọi file JSON kịch bản phải khớp Zod Schema từ `@chronoviet/shared-spec`).
- **Layout Coverage Rate**: $31 / 31$ Layout Modes (18 Core + 13 Extended).
- **Transition Coverage Rate**: $19 / 19$ Transition Types.
- **Zero Image Artifact Policy**: $0$ file ảnh thừa sinh ra trong `eval/out`.

---

## 📁 Directory Structure
```text
eval/
├── README.md         # Tài liệu hướng dẫn đánh giá này
├── test-cases/       # Kịch bản JSON v3.2 mẫu phủ 18 LayoutModes & 15 Transitions
├── reports/          # Báo cáo kết quả kiểm định (JSON / Markdown)
├── out/              # Thư mục output sạch (Không chứa ảnh dư thừa)
└── runner.ts         # Script kiểm định tự động & tự mở Remotion Studio
```

---

## 🚀 How to Run Evaluation (Tất cả lệnh chạy từ Root Monorepo)

### 1. Lệnh cơ bản (Chạy từ Root Monorepo)
```bash
# Chạy suite eval tự động & mở Studio GUI từ root monorepo:
pnpm --filter @chronoviet/remotion-engine eval
```
> Khi chạy lệnh trên: Hệ thống sẽ đánh giá tự động Phase 1 -> Báo cáo Phase 2 -> Tự động khởi chạy **Remotion Studio GUI** ở Phase 3.

### 2. Tùy chỉnh Vị trí Thư mục & Chế độ Headless (Chạy tại Root Monorepo)
```bash
# Chỉ định thư mục test cases và thư mục báo cáo riêng:
pnpm --filter @chronoviet/remotion-engine eval -- -t packages/remotion-engine/eval/test-cases -r packages/remotion-engine/eval/reports

# Tắt tự động mở Studio GUI (dành cho môi trường CI/CD headless):
pnpm --filter @chronoviet/remotion-engine eval -- --no-studio
```

### 3. Tham Số CLI cho `eval/runner.ts`:
| Tham số | Viết tắt | Mô tả | Mặc định |
| :--- | :--- | :--- | :--- |
| `--testCasesDir` | `-t` | Thư mục chứa các file JSON test cases | `eval/test-cases` |
| `--outDir` | `-o` | Thư mục output (giữ sạch) | `eval/out` |
| `--reportsDir` | `-r` | Thư mục lưu báo cáo kiểm định Markdown/JSON | `eval/reports` |
| `--no-studio` / `--ci` | - | Tắt tự động mở Remotion Studio GUI | `false` |

