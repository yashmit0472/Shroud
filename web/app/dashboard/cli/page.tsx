import Link from "next/link";
import { ArrowLeft, Terminal } from "lucide-react";
import { BrowserTerminal } from "@/components/browser-terminal";

export default function CliPage() {
  return <main>
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Workspace</Link>
      <div className="mt-8 flex items-center gap-3"><span className="brand-mark"><Terminal className="h-5 w-5" /></span><span className="eyebrow">Developer tools</span></div>
      <h1 className="mt-5 text-4xl font-semibold tracking-[-.04em]">Shroud terminal</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Manage secrets from your browser. No installation, API token, or extra login required.</p>
      <div className="mt-8"><BrowserTerminal /></div>
      <Link href="/docs#cli" className="mt-8 inline-block text-sm font-semibold text-lime-300 hover:underline">Read the command guide →</Link>
    </div>
  </main>;
}

