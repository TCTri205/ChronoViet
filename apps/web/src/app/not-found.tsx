export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-lacquer-deep text-text-primary p-6 text-center">
      <h1 className="text-4xl font-serif font-bold text-gold-400 mb-4">404 — Không Tìm Thấy Trang</h1>
      <p className="text-text-muted mb-6">Trang bạn đang tìm kiếm không tồn tại trong hệ thống ChronoViet.</p>
      <a href="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
        Quay lại Trang Chủ
      </a>
    </div>
  );
}
