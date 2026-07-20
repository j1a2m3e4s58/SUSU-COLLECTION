import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  confirmDisabled = false,
  secondaryLabel = "",
  secondaryBusy = false,
  onSecondary,
  notice,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[380px] rounded-xl p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {notice && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-muted-foreground">
            {notice}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          {secondaryLabel && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-blue-500/30 text-blue-600 sm:w-auto"
              disabled={busy || secondaryBusy}
              onClick={onSecondary}
            >
              {secondaryBusy ? "Exporting..." : secondaryLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            className="w-full sm:w-auto"
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
          >
            {busy ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
