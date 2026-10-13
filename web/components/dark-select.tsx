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
      <DropdownMenuTrigger aria-label={label} disabled={disabled} className="auth-input !mt-2 flex items-center justify-between gap-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50">
        <span className="truncate">{selected?.label ?? placeholder}</span><ChevronDown className="h-4 w-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-64 rounded-xl border border-white/15 bg-[#141d2b] p-1.5 shadow-2xl">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(String(next))}>
          {allowEmpty && <DropdownMenuRadioItem value="" className="px-3 py-2.5 text-muted-foreground data-highlighted:bg-lime-300/10 data-highlighted:text-lime-200">{placeholder}</DropdownMenuRadioItem>}
          {options.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value} className="px-3 py-2.5 text-slate-200 data-highlighted:bg-lime-300/10 data-highlighted:text-lime-200 data-checked:bg-lime-300/10 data-checked:text-lime-200">{option.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
