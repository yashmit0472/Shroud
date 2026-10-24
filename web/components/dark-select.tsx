"use client";

import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  allowEmpty?: boolean;
};

export function DarkSelect({ label, value, onChange, options, placeholder, disabled, allowEmpty }: Props) {
  const selected = options.find((option) => option.value === value);
  return <div className="space-y-2 text-xs font-medium text-muted-foreground">
    <span>{label}</span>
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} disabled={disabled} className="auth-input !mt-1 !h-8 flex items-center justify-between gap-3 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50">
        <span className="truncate">{selected?.label ?? placeholder}</span><ChevronDown className="h-4 w-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-64 rounded-md border border-white/15 bg-popover p-1.5 shadow-lg">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(String(next))}>
          {allowEmpty && <DropdownMenuRadioItem value="" className="px-3 py-2 text-muted-foreground data-highlighted:bg-accent data-highlighted:text-foreground">{placeholder}</DropdownMenuRadioItem>}
          {options.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value} className="px-3 py-2 text-foreground data-highlighted:bg-accent data-highlighted:text-foreground data-checked:bg-accent data-checked:text-foreground">{option.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
