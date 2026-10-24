import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ArrowLeft, LockKeyhole } from "lucide-react";

export function AuthShell({children}:{children:React.ReactNode}) {
  return <main className="auth-shell grid min-h-screen lg:grid-cols-2">
    <section className="hidden flex-col justify-between border-r border-border p-12 lg:flex"><Link href="/" className="flex items-center gap-3 text-xs font-semibold tracking-wider"><BrandMark />SHROUD</Link><div className="max-w-md"><p className="eyebrow">Made for builders</p><h1 className="mt-5 text-5xl font-semibold leading-[1.1] tracking-[-.05em]">Every secret.<br/>A clear home.</h1><p className="mt-5 text-sm leading-7 text-muted-foreground">Your projects, environments, and teammates. One place to keep configuration under control.</p><div className="mt-8 border-l border-primary/50 pl-4 font-mono text-xs leading-8 text-muted-foreground"><p>development / staging / production</p><p>encrypted · scoped · versioned</p></div></div><span className="flex items-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole size={13}/>Values encrypted before storage.</span></section>
    <section className="flex min-w-0 flex-col px-6 py-7 sm:px-12"><Link href="/" className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft size={13}/>Back to Shroud</Link><div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-14">{children}</div><p className="text-center text-[10px] text-muted-foreground">Shroud / Configuration, under control.</p></section>
  </main>;
}
