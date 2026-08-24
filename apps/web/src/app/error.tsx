'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-lacquer-deep text-text-primary p-6 text-center">
      <h1 className="text-4xl font-serif font-bold text-red-400 mb-4">Đã Xảy Ra Lỗi</h1>
      <p className="text-text-muted mb-6">{error.message || 'Hệ thống gặp sự cố trong quá trình xử lý.'}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
      >
        Thử lại
      </button>
    </div>
  );
}
