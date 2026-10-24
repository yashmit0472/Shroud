// Browser persistence window, renewed when Supabase refreshes its tokens.
// Server-side session revocation/expiry is still controlled by Supabase.
export const sessionCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};
