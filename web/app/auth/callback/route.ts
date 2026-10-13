import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/onboarding";
  const next = safeRedirectPath(requestedNext, "/onboarding");

  function errorRedirect(message: string) {
    const url = new URL("/auth/error", origin);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  }

  if (!code) {
    return errorRedirect(searchParams.get("error_description") ?? searchParams.get("error") ?? "Google did not return an authorization code. Check the Google provider and redirect URL settings.");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth callback error:", error.message);
    return errorRedirect(error.message);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
