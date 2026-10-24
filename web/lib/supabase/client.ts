import { createBrowserClient } from "@supabase/ssr";
import { sessionCookieOptions } from "./session-options";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: sessionCookieOptions, auth: { persistSession: true, autoRefreshToken: true } },
  );
}
