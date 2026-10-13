"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CommandBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <div className="code-window my-4">
    <div className="code-window-top"><span className="window-dots"><i /><i /><i /></span><span>{label ?? "terminal"}</span><button type="button" onClick={copy} className="ml-auto flex items-center gap-1 hover:text-foreground" aria-label="Copy command">{copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}</button></div>
    <pre className="overflow-x-auto whitespace-pre p-5 font-mono text-[13px] leading-7 text-[#d6e4e0]"><code>{code}</code></pre>
  </div>;
}

