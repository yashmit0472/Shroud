import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck, Terminal } from "lucide-react";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell min-h-screen">
      <div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
        <section className="hidden flex-col justify-between border-r border-white/8 px-10 py-10 lg:flex xl:px-20 xl:py-16">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight"><span className="brand-mark"><LockKeyhole className="h-5 w-5" /></span> Shroud</Link>
          <div className="max-w-xl pb-10">
            <div className="eyebrow"><span className="status-dot" /> The developer control plane</div>
            <h1 className="mt-7 text-5xl font-semibold leading-[1.06] tracking-[-.055em] xl:text-6xl">One place for every secret your team ships with.</h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Keep environments in sync, give teammates the right access, and bring configuration into your terminal without passing .env files around.</p>
            <div className="code-window mt-12 max-w-lg">
              <div className="code-window-top"><span className="window-dots"><i /><i /><i /></span><span className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5" /> shroud cli</span></div>
              <div className="space-y-3 p-6 font-mono text-sm"><p><span className="text-lime-300">$</span> shroud use api</p><p className="text-muted-foreground">âœ“ Entered API project</p><p><span className="text-lime-300">$</span> shroud env development</p><p className="text-muted-foreground">âœ“ Entered Development environment</p></div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-lime-300" /> Encrypted values. Scoped access. Clear audit history.</div>
        </section>
        <section className="flex flex-col px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
          <div className="flex items-center justify-between lg:justify-end"><Link href="/" className="flex items-center gap-2 font-semibold lg:hidden"><span className="brand-mark"><LockKeyhole className="h-4 w-4" /></span>Shroud</Link><Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to home</Link></div>
          <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-14">{children}</div>
          <p className="text-center text-xs text-muted-foreground">Built for the way developers actually work.</p>
        </section>
      </div>
    </main>
  );
}
