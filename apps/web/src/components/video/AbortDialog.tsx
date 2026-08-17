"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface AbortDialogProps {
  isOpen: boolean;
  onConfirmAbort: () => void;
  onClose: () => void;
}

export function AbortDialog({
  isOpen,
  onConfirmAbort,
  onClose,
}: AbortDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="bg-lacquer-surface border border-destructive/40">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-headline text-lg text-destructive">
            Dừng Tạo Thước Phim Này?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-text-secondary text-xs leading-relaxed">
            Hành động này sẽ hủy toàn bộ tiến trình Multi-Agent và giải phóng tài nguyên GPU/Worker Render. Tiến trình chưa hoàn tất sẽ bị hủy bỏ.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} className="text-xs h-8">
            Tiếp tục tạo
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmAbort}
            className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Xác nhận Hủy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
