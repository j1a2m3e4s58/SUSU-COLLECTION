import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function PageControls({ pagination, onPageChange, className = "" }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className={`mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 ${className}`}>
      <p className="text-xs text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!pagination.hasPrevious}
          onClick={() => onPageChange(pagination.page - 1)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <button
          type="button"
          disabled={!pagination.hasNext}
          onClick={() => onPageChange(pagination.page + 1)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
