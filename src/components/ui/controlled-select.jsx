import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ControlledSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  disabled = false,
  contentClassName = "",
  emptyLabel = "",
}) {
  const emptyValue = "__empty__";
  const normalizedOptions = (options || []).map((option) => (
    typeof option === "string" ? { value: option, label: option } : option
  ));
  return (
    <Select
      value={value || (emptyLabel ? emptyValue : "")}
      onValueChange={(next) => onChange(next === emptyValue ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        align="start"
        collisionPadding={12}
        position="popper"
        sideOffset={6}
        className={`z-[120] max-h-[min(18rem,45vh)] min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl border-border bg-popover shadow-2xl ${contentClassName}`}
      >
        {emptyLabel && (
          <SelectItem value={emptyValue}>
            {emptyLabel}
          </SelectItem>
        )}
        {normalizedOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
