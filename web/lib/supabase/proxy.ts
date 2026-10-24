import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { workspaceCookieName, workspaceCookieOptions } from "@/lib/workspace-selection";
import { sessionCookieOptions } from "./session-options";
import { signedInRedirectPath } from "@/lib/auth-redirect";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  function preserveSession(response:NextResponse){
    supabaseResponse.cookies.getAll().forEach(cookie=>response.cookies.set(cookie));
    for(const name of ["Cache-Control","Expires","Pragma"]){
      const value=supabaseResponse.headers.get(name);
      if(value)response.headers.set(name,value);
    }
    return response;
  }

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = preserveSession(NextResponse.next({
            request,
          }));
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name,value])=>supabaseResponse.headers.set(name,value));
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const signInPages=["/login","/auth/login","/auth/sign-up"];
  if(user&&signInPages.includes(request.nextUrl.pathname)){
    const destination=signedInRedirectPath(request.nextUrl.searchParams.get("redirect"));
    const url=new URL(destination,request.url);
    return preserveSession(NextResponse.redirect(url));
  }

  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/docs") &&
    !request.nextUrl.pathname.startsWith("/downloads") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/api/v1") &&
    request.nextUrl.pathname !== "/api/browser-cli" &&
    request.nextUrl.pathname !== "/api/workspaces"
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return preserveSession(NextResponse.redirect(url));
  }

  const projectId = request.nextUrl.pathname.match(/^\/dashboard\/projects\/([a-f0-9-]{36})(?:\/|$)/i)?.[1];
  if (user && projectId) {
    const { data: project } = await supabase.from("projects").select("team_id").eq("id", projectId).maybeSingle();
    if (project && request.cookies.get(workspaceCookieName)?.value !== project.team_id) {
      request.cookies.set(workspaceCookieName, project.team_id);
      supabaseResponse = preserveSession(NextResponse.next({ request }));
      supabaseResponse.cookies.set(workspaceCookieName, project.team_id, workspaceCookieOptions);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
