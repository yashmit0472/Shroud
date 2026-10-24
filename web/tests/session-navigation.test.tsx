import React from "react";
import {act,render,screen} from "@testing-library/react";
import {beforeEach,expect,test,vi} from "vitest";
import type {AuthChangeEvent,Session} from "@supabase/supabase-js";
import {AuthSessionProvider} from "@/components/auth-session-provider";
import {PublicAuthNav,SessionAction} from "@/components/public-auth-nav";
import {LoginForm} from "@/components/login-form";

const mocks=vi.hoisted(()=>({listener:null as null|((event:AuthChangeEvent,session:Session|null)=>void),unsubscribe:vi.fn(),router:{replace:vi.fn(),refresh:vi.fn()}}));
vi.mock("next/navigation",()=>({useRouter:()=>mocks.router}));
vi.mock("@/lib/supabase/client",()=>({createClient:()=>({auth:{onAuthStateChange:(listener:typeof mocks.listener)=>{mocks.listener=listener;return {data:{subscription:{unsubscribe:mocks.unsubscribe}}};}}})}));
beforeEach(()=>{mocks.listener=null;vi.clearAllMocks();});
function session(){return {user:{id:"test-user"}} as Session;}

test("persisted login restores dashboard links on home and docs and survives token refresh",()=>{
 const view=render(<AuthSessionProvider><PublicAuthNav/><PublicAuthNav compact/><SessionAction guestHref="/auth/sign-up" guestLabel="Get started"/></AuthSessionProvider>);
 expect(screen.queryByText("Sign in")).toBeNull();
 act(()=>mocks.listener?.("INITIAL_SESSION",session()));
 expect(screen.getAllByText("Open dashboard")).toHaveLength(3);
 expect(screen.queryByText("Sign in")).toBeNull();
 expect(screen.queryByText("Get started")).toBeNull();
 for(const link of screen.getAllByRole("link"))expect(link.getAttribute("href")).toBe("/dashboard");
 act(()=>mocks.listener?.("TOKEN_REFRESHED",session()));
 expect(screen.getAllByText("Open dashboard")).toHaveLength(3);
 view.unmount();expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});

test("sign-out updates public navigation, and a subsequent sign-in restores it",()=>{
 render(<AuthSessionProvider><PublicAuthNav/></AuthSessionProvider>);
 act(()=>mocks.listener?.("INITIAL_SESSION",session()));
 act(()=>mocks.listener?.("SIGNED_OUT",null));
 expect(screen.getByRole("link",{name:"Sign in"}).getAttribute("href")).toBe("/login");
 expect(screen.getByRole("link",{name:"Get started"})).toBeTruthy();
 act(()=>mocks.listener?.("SIGNED_IN",session()));
 expect(screen.getByRole("link",{name:"Open dashboard"})).toBeTruthy();
});

test("a signed-in workspace creation link opens onboarding rather than signing up again",()=>{
 render(<AuthSessionProvider><SessionAction guestHref="/auth/sign-up" guestLabel="Create workspace" memberLabel="Create workspace" memberHref="/onboarding/create-team"/></AuthSessionProvider>);
 act(()=>mocks.listener?.("INITIAL_SESSION",null));
 expect(screen.getByRole("link").getAttribute("href")).toBe("/auth/sign-up");
 act(()=>mocks.listener?.("SIGNED_IN",session()));
 expect(screen.getByRole("link").getAttribute("href")).toBe("/onboarding/create-team");
});

test("a cached login page redirects a restored session without asking for credentials",()=>{
 window.history.replaceState({},"","/login?redirect=%2Finvite%2Ftest-invitation");
 render(<AuthSessionProvider><LoginForm/></AuthSessionProvider>);
 act(()=>mocks.listener?.("INITIAL_SESSION",session()));
 expect(mocks.router.replace).toHaveBeenCalledWith("/invite/test-invitation");
 expect(mocks.router.refresh).toHaveBeenCalled();
 window.history.replaceState({},"","/login");
});
