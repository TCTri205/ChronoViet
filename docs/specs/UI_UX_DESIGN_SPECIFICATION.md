# ĐẶC TẢ THIẾT KẾ GIAO DIỆN NGƯỜI DÙNG (UI/UX DESIGN SPECIFICATION v1.5)
## ChronoViet NotebookLM-Inspired Heritage Workspace & 1-Click Video Generator

---

## 1. Triết Lý & Bản Sắc Thiết Kế (Design Philosophy & Identity)

ChronoViet là nền tảng sáng tạo nội dung video tài liệu lịch sử Việt Nam tự động hóa 100% bằng trí tuệ nhân tạo (Multi-Agent). Thiết kế giao diện người dùng của ChronoViet hướng đến sự kết hợp hài hòa giữa **Bản sắc di sản truyền thống Việt Nam** và **Trải nghiệm không gian làm việc tri thức số hiện đại (Modern Knowledge Workspace)**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                3 TRỤ CỘT THIẾT KẾ CHÍNH                                  │
├───────────────────────────────┬───────────────────────────────┬──────────────────────────┤
│ 1. Bản Sắc Sơn Mài & Hoàng Kim│ 2. Tự Động Hóa Tuyệt Đối      │ 3. Tri Thức Đáng Tin Cậy │
│    (Heritage Aesthetic)       │    (Zero Manual Intervention) │    (Verifiable Knowledge)│
├───────────────────────────────┼───────────────────────────────┼──────────────────────────┤
│ • Nền đen sơn mài trầm tĩnh   │ • Người dùng không phải kéo   │ • Mọi luận điểm lịch sử  │
│   kèm vi hạt (noise grain)    │   thả timeline hay sửa frame  │   đều có trích dẫn nguồn │
│ • Ánh kim vàng hoàng triều    │ • 1-Click kích hoạt toàn bộ   │   gốc (Đại Việt Sử Ký…)  │
│ • Đồng hun & đỏ son điểm xuyết│   chuỗi 15 trạng thái Multi-  │ • Bảng kê khai bản quyền │
│ • Typography di sản chuẩn Việt│ • Trực quan hóa tiến độ live  │   tư liệu minh bạch (CC0)│
│ • Độ tương phản chuẩn WCAG AA │ • Tự động phục hồi & Fallback │ • Cuộn thư tra cứu gốc   │
└───────────────────────────────┴───────────────────────────────┴──────────────────────────┘
```

---

## 2. Hệ Thống Design Tokens & Bảng Màu Di Sản (Visual Design Tokens)

### 2.1. Bảng Màu HSL & Hex (Color Palette)

Toàn bộ bảng màu được xây dựng trên hệ thống Dark Theme cao cấp, triệt tiêu hoàn toàn các màu tím/neon cliché, mang đến cảm giác uy nghiêm, trầm mặc và sắc nét:

| Tên Token CSS | Giá Trị Hex / HSL | Mục Đích Sử Dụng | Tiêu Chuẩn Contrast |
| :--- | :--- | :--- | :--- |
| `--bg-lacquer-deep` | `#08090B` / `hsl(220, 16%, 4%)` | Nền canvas chính toàn ứng dụng (Sơn mài đen sâu) | Nền gốc |
| `--bg-lacquer-surface` | `#111418` / `hsl(214, 16%, 8%)` | Nền Card, Sidebar, Chat Hub, Studio Panel | Phân tầng cấp 1 |
| `--bg-lacquer-elevated` | `#1A1F26` / `hsl(215, 19%, 13%)` | Nền Popover, Modal, Input, Hover State | Phân tầng cấp 2 |
| `--border-bronze-subtle` | `rgba(212, 175, 55, 0.12)` | Đường viền mảnh (hairline 1px) ngăn cách các khối | Tinh tế, không gây nhiễu |
| `--border-bronze-active` | `rgba(212, 175, 55, 0.45)` | Viền active, focus ring, node đang xử lý | Nổi bật trạng thái |
| `--gold-imperial-500` | `#D4AF37` / `hsl(46, 65%, 52%)` | Màu chủ đạo: Nút CTA 1-Click, Icon chính, Key badge | 12.8:1 trên nền đen |
| `--gold-imperial-300` | `#F3E5AB` / `hsl(47, 78%, 81%)` | Tiêu đề di sản quan trọng, Karaoke highlight | 15.6:1 trên nền đen |
| `--gold-imperial-glow` | `rgba(212, 175, 55, 0.20)` | Vầng sáng hoàng kim xung quanh node đang render | Micro-interaction |
| `--vermilion-accent` | `#C0392B` / `hsl(6, 63%, 46%)` | Điểm xuyết son đỏ: Tag triều đại, cảnh báo hệ thống, triện ấn | 4.8:1 (WCAG AA) |
| `--emerald-jade` | `#1B4D3E` / `hsl(161, 48%, 21%)` | Trạng thái hoàn thành (Success, Health OK) | Đạt chuẩn hỗ trợ thị giác |
| `--amber-warning` | `#D97706` / `hsl(38, 92%, 50%)` | Trạng thái đang khôi phục kết nối / Fact-Checker lưu ý | 6.5:1 (WCAG AAA) |
| `--text-primary` | `#EDEDEF` / `hsl(240, 5%, 93%)` | Văn bản chính, nội dung hội thoại | 14.2:1 (WCAG AAA) |
| `--text-secondary` | `#9DA5B4` / `hsl(220, 11%, 66%)` | Văn bản phụ, chú thích, mô tả bước | 7.5:1 (WCAG AAA) |
| `--text-muted` | `#5E6676` / `hsl(220, 11%, 42%)` | Placeholder, timestamp mờ, icon phụ | 4.6:1 (WCAG AA) |

---

### 2.2. Hệ Thống Typography (Phông Chữ & Thang Tỷ Lệ Chuẩn Việt)

Nhằm đảm bảo hiển thị hoàn hảo 100% các ký tự dấu tiếng Việt phức tạp (*ơ, ư, ă, đ*, dấu hỏi/ngã/nặng) mà không bị lỗi đè chữ, cắt dấu (clipping) hay font-fallback:

1. **Display & Heritage Headings (`Playfair Display` / `Cormorant Garamond`)**:
   - Cấu hình qua `next/font/google` với `subsets: ['vietnamese', 'latin']`, gán biến `--font-playfair`.
   - Sử dụng cho: Tiêu đề ứng dụng, tên chiến dịch/triều đại lịch sử, tiêu đề cuộn thư sử liệu gốc.
2. **Body & Interface (`Be Vietnam Pro`)**:
   - Cấu hình qua `next/font/google` với `subsets: ['vietnamese', 'latin']`, gán biến `--font-be-vietnam-pro`.
   - Sử dụng cho: Toàn bộ văn bản giao diện, nội dung đoạn chat RAG, nhãn nút thao tác, danh sách dự án.
3. **Monospace Metadata (`JetBrains Mono` / `ui-monospace`)**:
   - Cấu hình qua `next/font/google` gán biến `--font-jetbrains-mono`.
   - Sử dụng cho: Bộ đếm frame (`Frame 450/1000`), thời gian mili-giây (`ms`), thông số bitrate/FPS của video.

---

### 2.3. Bảng Quy Chuẩn Typography & Spacing (Vietnamese Typographic Rules)

| Phân Cấp Chữ | Font Family | Size / Line-Height | Weight | Letter-Spacing | Ứng Dụng Thực Tế & Web Guidelines |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero (H1)** | `var(--font-playfair)`, serif | `32px / 1.25` | 700 (Bold) | `-0.02em` | Tên chủ đề sử thi, tiêu đề cuộn thư (`text-wrap: balance`) |
| **Section Title (H2)** | `var(--font-playfair)`, serif | `20px / 1.30` | 600 (SemiBold) | `-0.01em` | Tiêu đề khối (Studio, Tra Cứu, Stepper) (`text-wrap: balance`) |
| **Subsection (H3)** | `var(--font-be-vietnam-pro)`, sans-serif | `15px / 1.40` | 600 (SemiBold) | `0em` | Tiêu đề thẻ dự án, tên bước Stepper (`text-pretty`) |
| **Body Primary** | `var(--font-be-vietnam-pro)`, sans-serif | `14px / 1.60` | 400 (Regular) | `0em` | Nội dung tin nhắn chat RAG, trích dẫn |
| **Body Compact / Label**| `var(--font-be-vietnam-pro)`, sans-serif | `12px / 1.50` | 500 (Medium) | `+0.01em` | Nhãn nút bấm, badge trạng thái, tooltip |
| **Data Monospace** | `var(--font-jetbrains-mono)`, monospace | `12px / 1.40` | 500 (Medium) | `0em` | Frame meter, timestamp mili-giây, health (`tabular-nums`) |

> ⚠️ **Lưu ý dấu thanh tiếng Việt & Micro-Typography:**
> 1. Mọi phần tử tiêu đề và văn bản tiếng Việt bắt buộc duy trì `line-height >= 1.25` (Display) và `line-height >= 1.60` (Body) kèm `overflow: visible` trên vùng chứa để các dấu mũ, dấu móc (*Ư, Ơ, Â, Ê*) và dấu nặng không bị cắt mép trên/dưới.
> 2. Sử dụng dấu ba chấm chuẩn typography `…` (`\u2026`) thay vì gõ 3 dấu chấm `...`.
> 3. Các con số nhảy realtime (Frame counter, thời lượng ms, %) bắt buộc gán `font-variant-numeric: tabular-nums` (class `tabular-nums`) để triệt tiêu rung giật layout (jittering).

---

### 2.4. Bề Mặt Sơn Mài & Điểm Chạm Độc Bản (Texture & Signature Polish)

- **Lacquer Noise Grain**: Lớp phủ vi hạt tinh tế `opacity: 0.025` trên toàn bộ nền canvas, mang lại chiều sâu như một bức tranh sơn mài truyền thống:
  ```css
  /* Noise Grain Overlay */
  .bg-lacquer-grain {
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E");
  }
  ```
- **Bronze Sheen Hairline Borders**: Đường viền mảnh với ánh kim đồng hun chuyển sắc tinh tế:
  ```css
  .border-bronze-gradient {
    border-image: linear-gradient(90deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.35) 50%, rgba(212,175,55,0.08) 100%) 1;
  }
  ```
- **Imperial Seal Animation (Triện Ấn Hoàng Triều)**: Biểu tượng triện son đỏ góc màn hình biến đổi động:
  - *Trầm tĩnh (Idle)*: Biểu tượng triện đồng chìm nhẹ (`opacity: 0.6`).
  - *Vận hành (Active Generation)*: Viền son đỏ thở chậm (`pulse 2.4s ease-in-out`) cùng ánh kim chạy tia.
  - *Hoàn tất (Completed)*: Hiệu ứng đóng dấu triện khắc kim đỏ son xác thực video đã sẵn sàng (`scale(1.05) -> scale(1.0)` với haptic glow).

---

### 2.5. Ma Trận Ánh Xạ CSS Tokens sang shadcn/ui Semantic Variables

Nhằm đảm bảo 100% các thành phần của **shadcn/ui** kế thừa tự nhiên phong cách Sơn Mài Hoàng Kim mà không cần ghi đè class màu thủ công:

```css
/* apps/web/src/app/globals.css */
@layer base {
  :root {
    color-scheme: dark;                  /* Bắt buộc dark mode cho native controls (scrollbars, form controls) */

    --background: 220 16% 4%;            /* #08090B Sơn mài đen sâu */
    --foreground: 240 5% 93%;            /* #EDEDEF Chữ chính tương phản cao */

    --card: 214 16% 8%;                  /* #111418 Nền thẻ & panel */
    --card-foreground: 240 5% 93%;

    --popover: 215 19% 13%;              /* #1A1F26 Nền popup, modal, dropdown */
    --popover-foreground: 240 5% 93%;

    --primary: 46 65% 52%;               /* #D4AF37 Hoàng kim hoàng gia */
    --primary-foreground: 220 16% 4%;    /* Chữ đen trên nền vàng kim */

    --secondary: 215 19% 13%;            /* #1A1F26 Khối phụ */
    --secondary-foreground: 240 5% 93%;

    --muted: 214 16% 12%;                /* #161A20 */
    --muted-foreground: 220 11% 66%;     /* #9DA5B4 Chữ phụ */

    --accent: 215 19% 16%;               /* Hover state trên item */
    --accent-foreground: 47 78% 81%;     /* #F3E5AB Ánh kim sáng khi hover */

    --destructive: 6 63% 46%;            /* #C0392B Đỏ son điểm xuyết / Cảnh báo hệ thống */
    --destructive-foreground: 240 5% 98%;

    --border: 46 65% 52% / 0.12;         /* Đường viền ánh kim đồng hun mảnh */
    --input: 46 65% 52% / 0.18;          /* Viền ô nhập */
    --ring: 46 65% 52%;                  /* Focus ring vàng hoàng triều */

    --radius: 0.5rem;                    /* Bo góc tinh tế 8px */
  }
}
```

> 💡 **Enforce Root Dark Theme**: Thẻ `<html>` trong `layout.tsx` khai báo `<html lang="vi" className="dark" style={{ colorScheme: 'dark' }}>` để triệt tiêu hiện tượng chớp sáng (white-flash) và ép toàn bộ native form/scrollbar của hệ điều hành về giao diện tối.

---

### 2.6. Quy Chuẩn Trợ Năng, Bàn Phím & Chuyển Động (Web Interface Guidelines Compliance)

Nhằm đáp ứng các tiêu chuẩn khắt khe nhất của giao diện web chuyên nghiệp (Vercel Web Interface Guidelines, WCAG 2.1 AA/AAA):

1. **Trợ Năng & ARIA (Accessibility & Screen Readers)**:
   - **Icon-Only Buttons**: Toàn bộ nút không chứa nhãn chữ (như Icon Rail Sidebar 64px, nút Play/Pause, Mute, Fullscreen, CC, nút Đóng/Mở Drawer) **bắt buộc** phải khai báo `aria-label="..."` tường minh (ví dụ: `aria-label="Thu gọn thanh điều hướng"`).
   - **Decorative Icons**: Tất cả icon minh họa (`lucide-react`, họa tiết trống đồng Đông Sơn) phải có `aria-hidden="true"`.
   - **Live Regions cho Streaming Real-time**: Khung Chat token stream (`ChatContainer.tsx`), Live Stepper (`LiveAgentStepper.tsx`), và Thanh Render (`RenderProgressBar.tsx`) phải gán `aria-live="polite"` và `role="status"` để thiết bị trợ năng cập nhật trạng thái mà không gây gián đoạn âm thanh của người dùng.
   - **Focus Trap & Restoration**: Toàn bộ Modal (`Dialog`) và Cuộn thư sử liệu (`Sheet`) tự động giữ focus (focus trap) khi mở và **hoàn trả focus (focus restoration)** về đúng phần tử kích hoạt ban đầu (như `CitationBadge`) khi đóng (`onClose`).
   - **Skip Navigation Link**: Đặt `<a href="#main-workspace" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg">Chuyển đến vùng làm việc chính</a>` tại `layout.tsx`.
   - **Touch Targets trên Thiết Bị Di Động**: Mọi phần tử tương tác trên màn hình cảm ứng ($< 1024px$) bảo đảm kích thước vùng chạm tối thiểu $44 \times 44\text{px}$ (`min-h-[44px] min-w-[44px]`).

2. **Ma Trận Phím Tắt & Điều Hướng Bàn Phím (Keyboard Navigation Matrix)**:
   - `⌘ + Enter` / `Ctrl + Enter`: Gửi nhanh Prompt tạo video hoặc gửi câu hỏi tra cứu sử liệu.
   - `Space` (Phím cách): Bật / Tạm dừng (Play/Pause) video (khi không focus vào ô input/textarea).
   - `Esc`: Đóng Cuộn Thư Sử Liệu (`Sheet`), đóng Dialog xác nhận Hủy tiến trình, hoặc thoát Chế độ Rạp hát (Cinema Mode).
   - `M`: Bật / Tắt tiếng (Mute/Unmute) trình phát video.
   - `F`: Bật / Tắt chế độ Toàn màn hình (Fullscreen Cinema Mode).
   - `focus-visible`: Không bao giờ dùng `outline-none` mà không thay thế bằng `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background`.

3. **Quy Chuẩn Trình Phát Đa Phương Tiện & iOS Safari (Media & Audio Autoplay Safety)**:
   - **Chống Tràn Toàn Màn Hình Ngoài Ý Muốn Trên iOS**: Mọi phần tử `<video>` trên `VideoPlayer.tsx` bắt buộc khai báo `playsInline` và `webkit-playsinline="true"` để đảm bảo video phát êm dịu ngay trên Floating Dock mà không bị trình phát QuickTime mặc định của iOS Safari cưỡng chế mở toàn màn hình, gây mất lớp phủ Karaoke Subtitles.
   - **Chính Sách Autoplay & An Toàn Âm Thanh**: Khi Phase 6 hoàn tất và Floating Dock trượt lên, video mặc định ở trạng thái **Sẵn sàng (Paused)** kèm nút Play to rõ ràng, hoặc phát thử nghiệm ở chế độ **Tắt tiếng (`muted`)** để tránh vi phạm chính sách Autoplay của trình duyệt gây ngoại lệ `NotAllowedError`.

4. **Chuyển Động & An Toàn Thị Giác (Motion Safety & Reduced Motion)**:
   - Tôn trọng thuộc tính hệ điều hành `prefers-reduced-motion`: Khi được kích hoạt, vô hiệu hóa hoặc làm dịu toàn bộ các hiệu ứng `pulse 2.4s` (Triện Ấn), `glow` hoàng kim, và chuyển động trượt Dock:
     ```css
     @media (prefers-reduced-motion: reduce) {
       *, *::before, *::after {
         animation-duration: 0.01ms !important;
         animation-iteration-count: 1 !important;
         transition-duration: 0.01ms !important;
         scroll-behavior: auto !important;
       }
     }
     ```
   - **Tối ưu hiệu năng Animation**: Chỉ animate `transform` và `opacity` trên GPU layer (không animate `width`, `height`, `margin` gây reflow); không sử dụng `transition: all` mà phải liệt kê rõ từng thuộc tính cần chuyển cảnh (`transition-[opacity,transform,background-color]`).

5. **Trải Nghiệm Biểu Mẫu & An Toàn Dữ Liệu (Form UX & Data Safety)**:
   - Không chặn thao tác dán (`onPaste` không bao giờ gọi `preventDefault()`).
   - Ô nhập chủ đề video & chat đặt `autocomplete="off"` và `spellcheck="false"` để tránh trình duyệt bung form quản lý mật khẩu che khuất gợi ý sử liệu.
   - **Double-Submit Guard**: Nút *"Tạo Thước Phim Lịch Sử"* tự động disable và hiển thị Spinner ngay khi bấm, ngăn chặn người dùng kích hoạt 2 pipeline render song song.
   - **Unsaved State Guard**: Đăng ký `beforeunload` khi Phase 6 đang render MP4 để cảnh báo người dùng tránh mất tiến trình kết xuất video.

6. **Phòng Ngừa Bàn Phím Ảo Di Động (Mobile Dynamic Viewport & Virtual Keyboard Defense)**:
   - Toàn bộ layout gốc (`layout.tsx`, `page.tsx`) sử dụng `min-h-dvh` / `h-dvh` thay vì `100vh` để tương thích hoàn hảo với Mobile Safari / Chrome khi bàn phím ảo trồi lên, tránh che khuất thanh input chat hay gây vỡ bố cục Dock.
   - Các Drawer/Sheet (`HistoricalSourceModal.tsx`, `AttributionDrawer.tsx`) cấu hình `max-h-[85dvh]` với `overflow-y-auto` và `overscroll-behavior: contain`.

7. **Đồng Bộ Dark-Heritage Toaster (`Sonner`)**:
   - Component `<Toaster />` cấu hình cố định `theme="dark"` tại `layout.tsx` với styling kế thừa semantic tokens:
     ```tsx
     <Toaster
       theme="dark"
       position="top-right"
       richColors
       toastOptions={{
         className: "bg-lacquer-surface border-bronze-subtle text-text-primary shadow-2xl backdrop-blur-md",
       }}
     />
     ```

---

## 3. Kiến Trúc Bố Cục Workspace Linh Hoạt (Responsive Dynamic Workspace)

Giao diện áp dụng cơ chế **Responsive 3-Column Workspace với Dynamic Focus & Collapsible Sidebar**, tự động phân bổ không gian tối ưu cho từng tác vụ:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏛️ CHRONOVIET  |  Không Gian Tri Thức Lịch Sử & Xưởng Phim Tự Động        🟢 Postgres  🟢 Redis  🟢 TTS:8080  🟢 LLM:Agnes     │
├─────┬───────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────┤
│ 📚  │ 💬 KHÔNG GIAN TRA CỨU & HỎI ĐÁP SỬ LIỆU       │ 🎬 XƯỞNG SẢN XUẤT VIDEO (1-CLICK STUDIO)                         │
│ SỬ  │                                               │                                                                  │
│ LIỆU│ ┌───────────────────────────────────────────┐ │ ┌──────────────────────────────────────────────────────────────┐ │
│ &   │ │ 👤 Bạn: Kể về Trận Bạch Đằng 1288…        │ │ │ ⚡ KHỞI TẠO VIDEO TỰ ĐỘNG                                    │ │
│ DỰ  │ └───────────────────────────────────────────┘ │ │                                                              │ │
│ ÁN  │ ┌───────────────────────────────────────────┐ │ │ Chủ đề: [ Trận chiến Bạch Đằng năm 1288                  ] │ │
│     │ │ 🏛️ ChronoViet:                         │ │ │ Thời lượng: [ 1 phút ] [ 3 phút★ ] [ 5 phút ]                  │ │
│ 🔍  │ │ Trận thủy chiến sông Bạch Đằng 1288…      │ │ │ Tỷ lệ:     [ 📺 16:9 Ngang ] [ 📱 9:16 Dọc ]                  │ │
│ [ ] │ │                                           │ │ │                                                              │ │
│     │ │ 🏷️ [1] Đại Việt Sử Ký Toàn Thư (Bản Kỷ X) │ │ │ [ ⚡ TẠO THƯỚC PHIM LỊCH SỬ (TỰ ĐỘNG 12 BƯỚC AI)            ] │ │
│ 🎬  │ │                                           │ │ └──────────────────────────────────────────────────────────────┘ │
│ BĐ  │ │ [ ⚡ Tạo Video từ chủ đề này ]             │ │                                                                  │
│ 88  │ └───────────────────────────────────────────┘ │ ┌──────────────────────────────────────────────────────────────┐ │
│     │                                               │ │ 🔄 TIẾN TRÌNH MULTI-AGENT TỰ ĐỘNG                            │ │
│ 🎬  │ ┌───────────────────────────────────────────┐ │ │  ✅ 1. RAG Tri Thức Sử Liệu (Đại Việt Sử Ký)                 │ │
│ CL  │ │ 💬 Nhập câu hỏi lịch sử cần tra cứu… [Gửi]  │ │ │  ✅ 2. Khởi Tạo Kịch Bản 3 Hồi (5-Step Engine)              │ │
│     │ └───────────────────────────────────────────┘ │ │  ✅ 3. Hội Đồng Thẩm Định Lịch Sử (0 Sai Lệch)               │ │
│     │                                               │ │  ✅ 4. Thu Âm Thuyết Minh VieNeu (Chính Xác ms)              │ │
│     │                                               │ │  ✅ 5. Thẩm Định Bản Quyền Tư Liệu Cổ (CC0/PD)               │ │
│     │                                               │ │  ⏳ 6. Render Remotion MP4 [======>   ] 65%                  │ │
│     │                                               │ │     Frame 650/1000 • Còn 18s • Concurrency=1                 │ │
│     │                                               │ └──────────────────────────────────────────────────────────────┘ │
├─────┴───────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────┤
│ 🎥 TRÌNH CHIẾU RẠP HÁT & KÊ KHAI BẢN QUYỀN (Floating Theater Dock - Trượt lên khi Video hoàn tất):                     │
│ [ ▶️ Phát MP4 1080p ] [ 🔊 100% ] [ 📝 Karaoke Highlight: "Vạn Kiếp sấm vang…" ] [ 📥 Tải Video ] [ 📜 Nguồn Tư Liệu ]  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Ma Trận Responsive & Mobile Breakpoints (Adaptive Layout Strategy)

Nhằm tối ưu hóa trải nghiệm trên mọi kích thước màn hình từ Studio Màn hình lớn đến Di động:

| Kích Thước Màn Hình | Điểm Ngắt (Breakpoint) | Bố Cục Sidebar | Khối Tra Cứu (Chat) & Khối Xưởng Phim (Studio) | Trình Chiếu Rạp Hát (Player) |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop / Studio** | $\ge 1280px$ (`xl`) | Icon Rail (64px) $\leftrightarrow$ Panel (280px) | 3 cột song song (Chat 45% + Studio 55%), hỗ trợ Resizable Split | Floating Dock trượt lên cố định ở đáy |
| **Laptop / Tablet Ngang** | $1024px - 1279px$ (`lg`) | Sidebar ẩn dạng Slide-over Drawer | 2 cột song song (Chat 50% + Studio 50%) | Floating Dock thu gọn thanh phát mini |
| **Tablet Dọc / Mobile** | $< 1024px$ (`md`, `sm`) | Sidebar ẩn trong nút Menu Header | **Tabbed Workspace**: Chuyển đổi `[ 💬 Tra Cứu Sử Liệu ]` và `[ 🎬 Xưởng Phim ]` | Fullscreen Cinema Modal tự động bật khi xong |

### 3.2. Phân Bổ Không Gian & Tương Tác Kéo Dãn (Resizable Split Pane)

- Trên màn hình Desktop, thanh ngăn cách giữa Khung Tra Cứu và Khung Studio hỗ trợ kéo thả tự do (`min-width: 380px` mỗi bên) sử dụng `react-resizable-panels` (`ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`).
- Khi người dùng bấm nút *"⚡ Tạo Video từ chủ đề này"*, hệ thống kích hoạt **Focus Transition**: Tự động mở rộng Khung Studio sang 65% độ rộng và làm mờ nhẹ Khung Chat để tăng sự tập trung vào quy trình sản xuất video.
- **Mobile Responsive State Syncing**: Trên mobile/tablet (<1024px) khi chuyển đổi qua lại giữa Tab Tra Cứu và Tab Xưởng Phim, trạng thái SSE stream tiến trình video vẫn được duy trì liên tục ở nền; Header tab hiển thị Badge tiến độ thu nhỏ (ví dụ: `🎬 65%`) để người dùng luôn nắm bắt được trạng thái.

---

## 4. Chi Tiết Các Khối Giao Diện & Tương Tác Người Dùng (UX Flow)

### 4.1. Thanh Điều Hướng & Giám Sát Hạ Tầng (Header & Multi-Node Health)
- **Brand Emblem**: Biểu tượng trống đồng Đông Sơn cách điệu ánh kim kết hợp chữ `ChronoViet` dập nổi phong thái hoàng triều.
- **Mobile Navigation Drawer**: Trên thiết bị di động (`< sm` / `< 640px`), nút Hamburger Menu trên Header kích hoạt một `Sheet` (Radix UI) trượt từ bên trái chứa toàn bộ kho lưu trữ dự án (`Sidebar`), cho phép tìm kiếm và chuyển đổi giữa các dự án một cách trực quan.
- **Multi-Node Health Indicators**: 4 nút trạng thái thời gian thực có tooltip chi tiết độ trễ, được định kỳ thăm dò (30s polling) qua endpoint live probe `/api/readyz` (kiểm tra `isPgAvailable()` và `redis.ping()` thực tế):
  - `PostgreSQL`: Trạng thái kết nối DB và HNSW vector store (`healthy` < 100ms, `degraded` nếu offline/mock, `unreachable` nếu lỗi).
  - `Redis`: Trạng thái hàng đợi BullMQ và PubSub gateway (`healthy`, `degraded`, `unreachable`).
  - `VieNeu TTS (Port 8080)`: Trạng thái engine tổng hợp giọng đọc tiếng Việt ONNX (`wordTimestamps`).
  - `LLM Provider`: Model đang kết nối (`Agnes 2.5 Flash / Qwen 3.8`).
- **Chỉ Báo Trạng Thái 3 Màu Di Sản**:
  - 🟢 **Xanh Lá (`#2ECC71`)**: Node phản hồi ổn định dưới 100ms.
  - 🟠 **Vàng Cam (`#F39C12`)**: Node đang hoạt động ở chế độ fallback/degraded hoặc độ trễ cao.
  - 🔴 **Đỏ Son (`--destructive`)**: Node mất kết nối hoặc không thể truy cập.
- **Project Context Switcher**: Dropdown (`Select` / `DropdownMenu`) chuyển đổi nhanh giữa các dự án đang tạo.
- **Client Bundle & Core Web Vitals Optimization**: Trình phát `VideoPlayer` được nạp động qua `next/dynamic` (`ssr: false`) kết hợp với `optimizePackageImports: ['lucide-react', '@radix-ui/react-icons']` trong `next.config.js`, giúp giảm kích thước First Load JS Bundle và đảm bảo CLS = 0.

---

### 4.2. Cột Trái: Kho Sử Liệu & Lịch Sử Dự Án (`Sidebar.tsx`)
- **Dual-State Sidebar**:
  - *Thu gọn (Icon Rail 64px)*: Tiết kiệm tối đa diện tích khi người dùng đang tập trung tra cứu hoặc xem video; mọi icon đều gắn `aria-label` và `Tooltip`.
  - *Mở rộng (Panel 280px)*: Mở khi rê chuột hoặc bấm nút mở rộng để tìm kiếm, lọc và quản lý toàn diện dự án.
  - *Mobile Sheet Drawer*: Tự động nhúng trong Sheet trượt từ cạnh trái khi xem trên mobile, đóng lại ngay khi người dùng chọn dự án.
- **Card Dự Án (Flex Overflow Defense)**:
  - Sử dụng `min-w-0` trên mọi flex container con, tiêu đề dài áp dụng `truncate` hoặc `line-clamp-1` để không làm bung layout sidebar.
  - Hiển thị tên chủ đề, nhãn tỷ lệ (`16:9` / `9:16`), badge trạng thái (`COMPLETED`, `RENDERING`, `FAILED`), thời lượng thực tế và mốc thời gian tạo.

---

### 4.3. Cột Giữa: Khung Tra Cứu Sử Liệu RAG (`ChatContainer.tsx`)
- **Streaming Token Response**: Gửi câu hỏi tới `POST /api/v1/chat`, render mượt mà 60 FPS, hỗ trợ Markdown bảng biểu và niên đại; vùng stream có `aria-live="polite"`.
- **Keyboard Shortcuts & IME Composition Safety**:
  - Nhấn `Enter` để gửi tin nhắn ngay lập tức.
  - Nhấn `Shift + Enter` để xuống dòng mới.
  - Hỗ trợ phím tắt chuyên nghiệp `⌘ + Enter` / `Ctrl + Enter`.
  - Tích hợp kiểm tra `e.nativeEvent.isComposing` chống kích hoạt gửi nhầm khi người dùng đang gõ dấu tiếng Việt (Telex/VNI).
- **Auto-Anchoring & Scroll-Lock Protection**:
  - Khi token đang streaming: Tự động bám đáy (`stick-to-bottom`) nếu người dùng đang ở cuối danh sách (`isAtBottom = true`).
  - Khi người dùng chủ động cuộn lên đọc tài liệu cũ: Ngắt ngay chế độ auto-scroll (tránh giật màn hình), đồng thời hiển thị nút nổi **`↓ Tin mới nhất`** (Floating Jump Button kèm badge số token mới) để người dùng quay lại đáy khi muốn.
- **Interactive Citation Scrolls (`CitationBadge.tsx` & `HistoricalSourceModal.tsx`)**:
  - Nhấp vào trích dẫn `[1] Đại Việt Sử Ký Toàn Thư` sẽ mở **Cuộn Thư Sử Liệu Gốc** dạng Drawer/Sheet (`Sheet` từ shadcn) mô phỏng trang sách cổ: hiển thị trích đoạn nguyên bản, niên đại, triều đại, cấp độ tin cậy (Level 1-3) và ngữ cảnh đối chiếu. Hình ảnh tư liệu cổ đi kèm bắt buộc có `alt` mô tả sử liệu và kích thước `width`/`height` chống dịch chuyển bố cục (CLS).
- **1-Click Handover**: Nút *"⚡ Tạo Video từ chủ đề này"* ở chân câu trả lời AI giúp tự động trích xuất nội dung và điền sẵn sang khung tạo video cột phải.

---

### 4.4. Cột Phải: Xưởng Phim Tự Động & Bảng Giám Sát (`VideoGeneratorPanel.tsx` & `LiveAgentStepper.tsx`)
- **Cấu hình 1-Click Tinh Gọn**:
  - Ô nhập Chủ đề / Prompt (`InputGroup` / `Field`) tự động gợi ý hoặc nhận từ Chat (`autocomplete="off"`).
  - Tùy chọn Thời lượng mục tiêu (`ToggleGroup`): `1 phút (Tóm lược)`, `3 phút (Tiêu chuẩn ★)`, `5 phút (Chuyên sâu)`.
  - Tùy chọn Tỷ lệ khung hình (`ToggleGroup`): `📺 16:9 (YouTube/Màn hình ngang)` hoặc `📱 9:16 (Shorts/Reels/TikTok)`.
  - **Bộ Chọn Sắc Thái & Phong Cách Lời Bình (`ToggleGroup`)**:
    1. ⚔️ **Hào Hùng (Sử Thi)** — `epic` (Mặc định): Phong cách tráng ca, nhịp điệu dồn dập, hào khí Đông A.
    2. 📜 **Trang Nghiêm (Chính Sử)** — `academic`: Điềm tĩnh, ngôn phong sử học chuẩn tắc.
    3. 🌊 **Trầm Lắng (Cảm Xúc)** — `reflective`: Lắng đọng, suy ngẫm tri ân công đức tiền nhân.
  - Nút bấm chính: **`Tạo Thước Phim Lịch Sử`** (Subtext: *Tự động hóa 15 trạng thái AI*, tự disable và hiện spinner chống double-click khi bấm).
- **Bảng Giám Sát Tiến Trình Realtime (Live Agent Stepper - `aria-live="polite"`)**:
  - Kết nối SSE stream `/api/v1/projects/:id/stream` hiển thị 6 giai đoạn cốt lõi với khả năng dọn dẹp kết nối tự động khi đạt trạng thái kết thúc (`COMPLETED`, `FAILED`, `ABORTED`):
    1. *Truy xuất sử liệu GraphRAG* (Tìm kiếm văn bản, thực thể, quan hệ lịch sử).
    2. *Khởi tạo kịch bản 3 hồi* (Phân bổ thời lượng & nhịp điệu phim).
    3. *Hội đồng thẩm định lịch sử* (Thẩm định dữ kiện, bảo đảm 0 sai lệch).
    4. *Thu âm thuyết minh VieNeu* (Tổng hợp giọng đọc & đồng bộ `wordTimestamps`).
    5. *Thẩm định bản quyền tư liệu cổ* (Kiểm tra giấy phép `CC0`, `Public Domain`, độ phân giải).
    6. *Render Remotion MP4* (Xuất video 1080p hoàn chỉnh).
  - **Render Progress Bar (`RenderProgressBar.tsx`)**: Lắng nghe Redis PubSub WebSocket (`role="status"`), hiển thị % tiến độ (`Progress`), đếm frame với `tabular-nums` (`Frame 650/1000`), thời gian còn lại, cơ chế auto-reconnect mượt mà khi rớt mạng.
- **Cơ Chế Tự Động Phục Hồi & Thử Lại Ngầm (Autonomous Retry & Self-Healing Pipeline)**:
  - Khi một Phase gặp sự cố mạng hoặc timeout hạ tầng (ví dụ: TTS VieNeu bị gián đoạn, VLM rate-limit), Orchestrator tự động kích hoạt Exponential Backoff Retry (thử lại ngầm tối đa 3 lần).
  - Nếu xảy ra lỗi không thể tự phục hồi sau 3 lần thử lại, Stepper chuyển Phase đó sang viền son đỏ (`--vermilion-accent`), hiển thị trạng thái `PhaseErrorState` kèm nút **`[ 🔄 Thử lại bước này ]`** (`POST /api/v1/projects/:id/retry-phase`) để người dùng kích hoạt lại mà không mất tiến trình trước đó.
- **Nút Hủy / Dừng Tạo Video (Abort Flow)**:
  - Khi quy trình đang thực thi, hiển thị nút `Hủy Tạo Video` với biểu tượng dừng; khi nhấn sẽ hiển thị `AlertDialog` (`AbortDialog.tsx`) xác nhận trước khi gửi lệnh `POST /api/v1/projects/:id/abort` tới orchestrator để thu hồi tài nguyên GPU/Worker.
- **Khôi Phục Phiên Làm Việc (Session Persistence & Hydration)**:
  - Dự án đang xử lý được lưu vào `localStorage` và đồng bộ qua query parameter `?projectId=…`. Khi người dùng tải lại trang (F5) hoặc đổi máy, hệ thống tự động kết nối lại SSE stream và phục hồi đúng vị trí Phase của Stepper.

---

### 4.5. Trình Chiếu Rạp Hát & Kê Khai Bản Quyền (`VideoPlayer.tsx` & `AttributionDrawer.tsx`)
- **Trình Tự Chuyển Giao Trực Quan Khi Render Hoàn Tất (Orchestrated Completion Transition)**:
  1. *Khắc dấu Triện Ấn*: Khi Phase 6 đạt 100%, biểu tượng Triện Ấn Hoàng Triều thực hiện hiệu ứng dập khắc kim son đỏ (`scale(1.08) -> scale(1.0)` kèm tia sáng hoàng kim).
  2. *Chuyển trạng thái Stepper*: Thanh `RenderProgressBar` hiển thị `Hoàn tất 100% (1080p sẵn sàng)` và chuyển icon sang Emerald Jade.
  3. *Trượt mở Floating Theater Dock*: Dock phát video trượt nhẹ nhàng từ đáy lên (`translate-y-0 opacity-100 transition-all duration-500 ease-out`).
- **Floating Theater Dock Controls & Native iOS Safari Protection**:
  - Trình phát MP4 1080p hỗ trợ tua seek tức thì qua HTTP Range Request.
  - Tính toán thời lượng an toàn với `Number.isFinite()` ngăn chặn lỗi hiển thị `NaN:NaN` trên thanh trượt timeline.
  - Khai báo bắt buộc `playsInline` và `webkit-playsinline="true"` trên thẻ `<video>` chống hiện tượng QuickTime chiếm quyền toàn màn hình trên iOS.
  - Video sẵn sàng ở trạng thái Paused kèm nút CTA Play ánh hoàng kim nổi bật (tránh vi phạm Browser Autoplay Policy).
  - Nút Tải Video 1080p (`video.mp4`) và nút chia sẻ liên kết.
  - **Fullscreen Cinema Theater Mode**: Nút phóng to toàn màn hình chuyển giao diện sang rạp chiếu phim chuyên biệt, ẩn toàn bộ header/sidebar, làm tối nền tối đa (`#040405`) để tập trung trọn vẹn vào thước phim.
- **Phụ Đề Karaoke Thời Gian Thực (`KaraokeSubtitles.tsx`)**:
  - Từng từ trong phụ đề phát sáng vàng hoàng kim (`--gold-imperial-300`) đồng bộ chính xác từng mili-giây với giọng đọc thuyết minh (`wordTimestamps`).
  - Hỗ trợ nút bật/tắt (Toggle CC) nhanh ngay trên thanh điều khiển video.
- **Bảng Kê Khai Nguồn Gốc & Bản Quyền Tư Liệu (`AttributionDrawer.tsx`)**:
  - Liệt kê toàn bộ tranh khắc, bản đồ, hình ảnh sử dụng trong video kèm giấy phép minh bạch (`CC0`, `Public Domain`, `CC-BY-4.0`) và link dẫn chứng lưu trữ qua component `Drawer` / `Sheet`.

---

### 4.6. Trạng Thái Rỗng, Tự Động Phục Hồi & Auto-Fallback (Empty, Auto-Recovery & Fallback States)
- **Empty Workspace State (`EmptyState.tsx`)**:
  - Khi chưa có dự án hay hội thoại nào, sử dụng component `Empty` từ shadcn kèm lời chào trang nhã cùng 4 thẻ gợi ý chủ đề lịch sử kinh điển (ví dụ: *Chiến thắng Bạch Đằng 1288*, *Khởi nghĩa Lam Sơn*, *Quang Trung đại phá quân Thanh*), bấm vào là kích hoạt tức thì.
- **Cơ Chế Autonomous Fallback & Tự Động Hóa Tuyệt Đối (Zero Manual Intervention)**:
  - Hệ thống Multi-Agent được thiết kế để tự động đưa ra quyết định mà **không làm gián đoạn người dùng**:
    1. *Tự Động Fallback Tư Liệu Hình Ảnh*: Khi VLM Inspector phát hiện tranh ảnh ứng viên có điểm số $<60$ hoặc bản quyền chưa rõ ràng, Agent tự động chọn ảnh ứng viên dự phòng đạt chuẩn CC0 từ kho di sản, hoặc tự động chuyển phân đoạn đó sang chế độ nghệ thuật chữ Thư Pháp Motion Graphics (`PURE_CODE`) đảm bảo chất lượng 1080p 60fps chuẩn điện ảnh.
    2. *Tự Động Hòa Giải Dữ Kiện Lịch Sử*: Khi Fact-Checker phát hiện các tài liệu có số liệu phân kỳ (ví dụ: số quân, mốc giờ), hệ thống tự động ưu tiên dữ liệu từ bộ Chính sử có cấp độ tin cậy cao nhất (Cấp 1 - *Đại Việt Sử Ký Toàn Thư*) và ghi chú nguồn minh bạch vào phần kê khai.
    3. *Tự Động Thử Lại (Exponential Backoff)*: Tự động phục hồi lỗi kết nối TTS VieNeu / Redis / LLM API mà không yêu cầu người dùng cấu hình lại.
- **Mất Kết Nối & Tự Động Phục Hồi (Auto-Reconnect Toast)**:
  - Khi WebSocket/SSE bị ngắt quãng, hiển thị thông báo `Sonner` toast màu hổ phách (`--amber-warning`): *"Đang tự động kết nối lại tiến trình render…"* và fallback sang polling HTTP mà không làm gián đoạn trải nghiệm người dùng.

---

### 4.7. Bảng Ánh Xạ Trạng Thái Multi-Agent LangGraph (15 States) Sang Live Stepper (6 Phases)

| Bước UI (Stepper Phase) | Tên Hiển Thị | Trạng Thái LangGraph Tương Ứng (15 Canonical States) | Kênh Sự Kiện & Dữ Liệu Stream |
| :---: | :--- | :--- | :--- |
| **Phase 1** | 📚 Khảo Cứu Sử Liệu GraphRAG | `INIT` $\rightarrow$ `RAG_RETRIEVED` | SSE `event: "agent_node"`, `data: { node: "rag_retriever", sources: [...] }` |
| **Phase 2** | ✍️ Khởi Tạo Kịch Bản 3 Hồi | `OUTLINE_CHAPTERED` $\rightarrow$ `CHAPTER_SCRIPT_GENERATED` | SSE `event: "agent_node"`, `data: { node: "scriptwriter", chapters: 3 }` |
| **Phase 3** | ⚖️ Thẩm Định Sử Liệu & Phân Đoạn | `CHAPTER_FACT_CHECKED` $\rightarrow$ `SCENES_SEGMENTED` $\rightarrow$ `RESEARCH_COMPLETED` | SSE `event: "agent_node"`, `data: { node: "fact_checker", violations: 0 }` |
| **Phase 4** | 🎙️ Thu Âm Thuyết Minh VieNeu | `TTS_SYNTHESIZED` $\rightarrow$ `DURATION_RECONCILED` | SSE `event: "agent_node"`, `data: { node: "vieneu_tts", durationMs: 180000 }` |
| **Phase 5** | 🔍 Thẩm Định Thị Giác & Bản Quyền | `KEYWORDS_EXTRACTED` $\rightarrow$ `ASSETS_AUDITED` | SSE `event: "agent_node"`, `data: { node: "vlm_inspector", approvedMedia: 8 }` |
| **Phase 6** | 🎬 Đóng Gói & Xuất Video Remotion | `PACKAGED` $\rightarrow$ `COMPLETED` *(hoặc `NEEDS_HUMAN_REVIEW` / `FAILED`)* | WS `/ws` `type: "render:progress"`, `data: { frame: 650, total: 1000, pct: 65 }` |

---

## 5. Danh Mục Component & Phân Rã Kỹ Thuật (Component Breakdown)

Toàn bộ components được tổ chức mô-đun hóa trong `apps/web/src/components/`:

```
apps/web/src/
├── app/
│   ├── globals.css                       # Design Tokens, Noise Overlay & shadcn Semantic Variables
│   ├── layout.tsx                        # Root Layout, Next.js Google Fonts (Be Vietnam Pro, Playfair Display)
│   └── page.tsx                          # Master Responsive Workspace (Chat + Studio + Floating Player)
├── components/
│   ├── ui/                               # shadcn/ui Primitives (@/components/ui/*)
│   │   ├── button.tsx                    # Button with variant & size tokens
│   │   ├── card.tsx                      # Card, CardHeader, CardTitle, CardContent
│   │   ├── dialog.tsx & sheet.tsx        # Slide-over drawers (Cuộn thư sử liệu) & Dialogs
│   │   ├── alert.tsx & alert-dialog.tsx  # Cảnh báo hệ thống & Xác nhận Hủy render (Abort)
│   │   ├── toggle-group.tsx              # Duration & Aspect Ratio selectors
│   │   ├── progress.tsx                  # Render Progress Bar
│   │   ├── badge.tsx                     # Project state & Citation badges
│   │   ├── tooltip.tsx                   # Health Indicators latency tooltips
│   │   ├── scroll-area.tsx               # Chat message auto-scroller container
│   │   ├── resizable.tsx                 # Resizable Panel Splitter
│   │   └── sonner.tsx                    # Toast notifications (Auto-reconnect, Alerts)
│   ├── layout/
│   │   ├── Header.tsx                    # Brand Emblem, Multi-Node Health Indicators, Project Switcher
│   │   ├── Sidebar.tsx                   # Collapsible Icon Rail & Project History List
│   │   └── __tests__/Header.test.tsx     # Smoke test Header & Health indicators
│   ├── chat/
│   │   ├── ChatContainer.tsx             # Chat message history, input bar, SSE stream consumer
│   │   ├── ChatMessage.tsx               # Markdown renderer, avatar, citation tag parser
│   │   ├── CitationBadge.tsx             # Interactive badge trigger for source modal
│   │   ├── HistoricalSourceModal.tsx     # Cuộn thư sử liệu gốc (Parchment Historical Sheet/Drawer)
│   │   └── EmptyChatState.tsx            # Gợi ý chủ đề lịch sử khởi đầu
│   ├── video/
│   │   ├── VideoGeneratorPanel.tsx       # 1-Click input form, duration & aspect ratio toggles
│   │   ├── LiveAgentStepper.tsx          # 12-state LangGraph mapper & node status indicator
│   │   ├── PhaseErrorState.tsx           # Inline retry & node recovery trigger (khi vượt quá max retries)
│   │   ├── RenderProgressBar.tsx         # WebSocket Redis PubSub listener & % frame meter
│   │   └── AbortDialog.tsx               # Dialog xác nhận dừng tiến trình và giải phóng tài nguyên
│   └── player/
│       ├── VideoPlayer.tsx               # HTML5 MP4 player with custom controls & seek (playsInline)
│       ├── KaraokeSubtitles.tsx          # Word-by-word synced subtitle overlay
│       └── AttributionDrawer.tsx         # Slide-out drawer with license & source records
```

---

### 5.1. Bảng Quy Chiếu shadcn Primitives cho Từng Khối Giao Diện

| Khối Giao Diện / Tính Năng | shadcn Primitives & Thư Viện Sử Dụng | Quy Tắc Thực Thi |
| :--- | :--- | :--- |
| **Bố Cục 3 Cột Workspace** | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` | `direction="horizontal"`, cấu hình `minSize={30}` và `defaultSize={45/55}`. |
| **Tùy Chọn Thời Lượng / Tỷ Lệ** | `ToggleGroup`, `ToggleGroupItem` | Dùng `type="single"` kết hợp `variant="outline"`, không loop Button thủ công. |
| **Form Tạo Video & Chat Input** | `Input`, `Textarea`, `Button` | Nút bấm dùng `data-icon="inline-start"`, không gán class size cứng vào icon. |
| **Cuộn Thư Sử Liệu & Bản Quyền** | `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` | Bắt buộc có `SheetTitle` (gán `className="sr-only"` nếu tiêu đề hiển thị riêng). |
| **Tiến Độ Render & Giám Sát** | `Progress`, `Badge`, `Skeleton` | Dùng `Progress value={pct}` kết hợp `Badge variant="outline"` cho Frame Count. |
| **Xác Nhận Hủy (Abort Flow)** | `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel` | Đảm bảo xác nhận rõ ràng trước khi dừng render để tránh mất dữ liệu. |
| **Toast Thông Báo** | `sonner` (`toast.warning`, `toast.success`) | Đặt `<Toaster theme="dark" position="top-right" richColors />` tại `layout.tsx`, auto-dismiss 4000ms. |

---

## 6. Kế Hoạch Triển Khai Chi Tiết (Sprint 3 Tasks)

| Task | Mục Tiêu & Trách Nhiệm | Files Tác Động & Dependencies |
| :---: | :--- | :--- |
| **3.1** | **Design Tokens, shadcn Setup & Responsive Layout Shell**<br>Cài đặt `tailwindcss`, `postcss`, `autoprefixer`, `tailwind-merge`, `clsx`, `cva`, `@radix-ui/*`, `lucide-react`, `sonner`, `react-resizable-panels`. Thiết lập biến màu CSS di sản, Google Fonts chuẩn Việt (`Playfair Display`, `Be Vietnam Pro`), Header với Health Check indicators, Sidebar thu gọn 2 chế độ kèm smoke test. | `apps/web/package.json`<br>`apps/web/src/app/globals.css`<br>`apps/web/src/app/layout.tsx`<br>`apps/web/src/components/layout/Header.tsx`<br>`apps/web/src/components/layout/Sidebar.tsx`<br>`apps/web/src/components/layout/__tests__/Header.test.tsx` |
| **3.2** | **Interactive Knowledge Hub & Historical Chatbot**<br>Xây dựng khung chat tra cứu RAG streaming tokens, render markdown, trích dẫn sử liệu tương tác, Cuộn thư sử liệu gốc qua `Sheet` và Empty Chat State. | `apps/web/src/components/chat/ChatContainer.tsx`<br>`apps/web/src/components/chat/ChatMessage.tsx`<br>`apps/web/src/components/chat/CitationBadge.tsx`<br>`apps/web/src/components/chat/HistoricalSourceModal.tsx`<br>`apps/web/src/components/chat/EmptyChatState.tsx` |
| **3.3** | **1-Click Autonomous Video Generator & Live Agent Stepper**<br>Xây dựng panel tạo video 1-click (`ToggleGroup`), Stepper 15 trạng thái LangGraph kết nối SSE, Render progress bar kết nối WebSocket, nút Hủy (Abort) với `AlertDialog` (`AbortDialog.tsx`) và cơ chế hiển thị tự động thử lại khi lỗi (`PhaseErrorState.tsx`). | `apps/web/src/components/video/VideoGeneratorPanel.tsx`<br>`apps/web/src/components/video/LiveAgentStepper.tsx`<br>`apps/web/src/components/video/RenderProgressBar.tsx`<br>`apps/web/src/components/video/PhaseErrorState.tsx`<br>`apps/web/src/components/video/AbortDialog.tsx` |
| **3.4** | **Floating Video Player, Karaoke Subtitles & Attribution Drawer**<br>HTML5 video player stream MP4 (Range request), overlay phụ đề Karaoke theo mili-giây, drawer tra cứu bản quyền tư liệu CC0 (`Drawer` / `Sheet`). | `apps/web/src/components/player/VideoPlayer.tsx`<br>`apps/web/src/components/player/KaraokeSubtitles.tsx`<br>`apps/web/src/components/player/AttributionDrawer.tsx` |
| **3.5** | **Master App Workspace Assembly & State Integration**<br>Lắp ráp toàn bộ components vào `apps/web/src/app/page.tsx`, tích hợp `ResizablePanelGroup`, quản lý luồng trạng thái từ Chat $\rightarrow$ Tạo Video $\rightarrow$ Giám sát $\rightarrow$ Phát video cùng cơ chế lưu trữ phiên (`localStorage` + URL query). | `apps/web/src/app/page.tsx` |

---

## 7. Tiêu Chí Nghiệm Thu Thiết Kế (Design Quality Gates)

1. **Độ Tương Phản, Trợ Năng & ARIA (Accessibility & Web Interface Guidelines)**:
   - Tất cả văn bản đạt tỷ lệ tương phản tối thiểu 4.5:1 (WCAG AA), văn bản chính đạt trên 7:1 (WCAG AAA).
   - 100% nút bấm icon-only có `aria-label`; các icon trang trí có `aria-hidden="true"`.
   - Vùng streaming real-time (Chat, Stepper, Render Progress) cấu hình `aria-live="polite"` và `role="status"`.
   - Hỗ trợ đầy đủ điều hướng bằng bàn phím (`⌘+Enter`, `Space`, `Esc`, `M`, `F`), focus ring rõ nét qua `focus-visible:ring-primary`. Focus trap & restoration hoạt động chuẩn mực khi mở/đóng Modal và Sheet.
   - Hỗ trợ `prefers-reduced-motion` làm dịu toàn bộ chuyển động lặp/pulse trên toàn ứng dụng.
2. **Tính Nhất Quán Bản Sắc & Không Bị Lỗi Dấu Tiếng Việt (Heritage Aesthetics & Typographic Integrity)**:
   - Thẻ `<html>` và `:root` khai báo `color-scheme: dark;` đảm bảo đồng bộ Dark Theme trên toàn bộ native browser controls.
   - 100% tiêu đề tiếng Việt hiển thị hoàn hảo qua `Playfair Display`, không bị font-fallback lỗi dấu, có `text-wrap: balance`.
   - Các chỉ số nhảy realtime (Frame counter, % render, time ms) bắt buộc dùng `tabular-nums` để chống giật chữ số.
   - Không sử dụng màu tím sặc sỡ trên nền tối, không dùng hiệu ứng gradient keyword lòe loẹt.
3. **Phòng Chống Tràn Bố Cục & An Toàn Form (Layout Resilience & Form UX)**:
   - Sử dụng `min-w-0` và `truncate`/`line-clamp-*` trên toàn bộ Flex children chứa văn bản dài (tên dự án, trích dẫn, tiêu đề).
   - Áp dụng `min-h-dvh` / `h-dvh` trên layout di động, đảm bảo bàn phím ảo không che khuất ô nhập hoặc gây vỡ thanh điều khiển.
   - Cơ chế bám đáy thông minh (`stick-to-bottom`) có scroll-lock ngắt tự động khi người dùng cuộn lên đọc tài liệu cũ.
   - Form input có `autocomplete="off"` và double-submit guard chống click lặp khi khởi tạo render video.
4. **Trình Phát Đa Phương Tiện & Phục Hồi Lỗi Vi Mô (Media & Granular Resilience)**:
   - Video Player có thuộc tính `playsInline` và `webkit-playsinline="true"`, phát êm dịu trên Floating Dock mà không bị iOS QuickTime chiếm toàn màn hình; an toàn trước chính sách Autoplay của trình duyệt.
   - Stepper hỗ trợ cơ chế Granular Phase Error Retry (`PhaseErrorState`), cho phép thử lại từng bước riêng lẻ mà không mất toàn bộ tiến trình.
5. **Tuân Thủ Tuyệt Đối Chuẩn shadcn/ui**:
   - Sử dụng đúng primitive của shadcn (`ToggleGroup`, `Sheet`, `AlertDialog`, `Progress`, `Badge`, `Sonner`, `ResizablePanelGroup`).
   - Sử dụng khoảng cách ngữ nghĩa `gap-*` (không dùng `space-y-*`), `size-*` cho hình vuông, `className` dùng cho layout thay vì ghi đè màu cứng.
6. **Hiệu Năng & Chuyển Động Trực Quan (Performance & Orchestration)**:
   - Nhận stream token chat và stream tiến trình LangGraph không gây giật lag UI (duy trì 60 FPS).
   - Phụ đề Karaoke cập nhật mượt mà theo từng mili-giây âm thanh.
   - Trình tự chuyển giao khi render xong (Phase 6 $\rightarrow$ Dập triện $\rightarrow$ Floating Dock trượt lên) mượt mà, không dùng `transition: all`, chỉ animate `transform` và `opacity`.
7. **Chuẩn Verification Toàn Monorepo**:
   - `pnpm --filter @chronoviet/web typecheck` đạt 0 lỗi TypeScript.
   - `pnpm --filter @chronoviet/web test` pass 100% các smoke tests và unit tests.
