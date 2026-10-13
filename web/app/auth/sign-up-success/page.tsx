import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

export default function Page() {
  return <AuthShell>
    <div className="auth-form">
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300"><MailCheck className="h-5 w-5" /></div>
      <p className="eyebrow">One last step</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em]">Check your inbox</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">If email confirmation is enabled, follow the link from Shroud to finish creating your account. Then sign in to open your workspace.</p>
      <Link href="/login" className="btn-accent mt-9 w-full">Back to sign in</Link>
    </div>
  </AuthShell>;
}
