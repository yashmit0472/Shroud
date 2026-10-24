import Link from "next/link";
import { Suspense } from "react";
import { CircleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

async function ErrorMessage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const {error}=await searchParams;
  const network=error?.toLowerCase().includes("fetch failed");
  return <p className="mt-3 text-sm leading-6 text-muted-foreground">{network?"We could not reach the sign-in service. Check your connection and try again.":"Your sign-in could not be completed. Try again or request a new sign-in link."}</p>;
}
export default function Page({searchParams}:{searchParams:Promise<{error?:string}>}){
  return <AuthShell><div className="auth-form"><CircleAlert size={24} className="mb-5 text-destructive"/><p className="eyebrow">Authentication</p><h1 className="mt-3 text-2xl font-semibold">Sign-in interrupted</h1><Suspense fallback={<div className="skeleton mt-4 w-3/4"/>}><ErrorMessage searchParams={searchParams}/></Suspense><Link href="/login" className="btn-accent mt-6">Try signing in again</Link><Link href="/docs#troubleshooting" className="mt-4 block text-xs text-muted-foreground hover:text-foreground">Sign-in help</Link></div></AuthShell>;
}
