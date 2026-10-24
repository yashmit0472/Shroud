import {beforeEach,expect,test,vi} from "vitest";
import {NextRequest} from "next/server";
import type {CookieOptions} from "@supabase/ssr";
const mocks=vi.hoisted(()=>({server:vi.fn(),signedIn:true,refresh:false}));
vi.mock("@supabase/ssr",()=>({createServerClient:mocks.server}));
vi.mock("@/lib/utils",()=>({hasEnvVars:true}));
import {updateSession} from "@/lib/supabase/proxy";
import {sessionCookieOptions} from "@/lib/supabase/session-options";
type Options={cookieOptions:CookieOptions;cookies:{setAll:(cookies:{name:string;value:string;options:CookieOptions}[],headers:Record<string,string>)=>void}};
beforeEach(()=>{
 vi.clearAllMocks();mocks.signedIn=true;mocks.refresh=false;
 mocks.server.mockImplementation((_url:string,_key:string,options:Options)=>({auth:{getClaims:async()=>{
  if(mocks.refresh)options.cookies.setAll([{name:"test-auth",value:"test-refreshed-cookie",options:{path:"/",maxAge:sessionCookieOptions.maxAge}}],{"Cache-Control":"private, no-store",Pragma:"no-cache"});
  return {data:{claims:mocks.signedIn?{sub:"test-user"}:null},error:null};
 }},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{team_id:"test-team"}})})})})}));
});
const request=(path:string)=>new NextRequest("http://localhost:3000"+path);

test.each(["/","/docs"])("%s keeps a signed-in session and forwards refreshed cookies",async(path)=>{
 mocks.refresh=true;const response=await updateSession(request(path));
 expect(response.headers.get("location")).toBeNull();
 expect(response.cookies.get("test-auth")?.value).toBe("test-refreshed-cookie");
 expect(response.headers.get("cache-control")).toContain("no-store");
 expect(mocks.server.mock.calls[0][2].cookieOptions.maxAge).toBe(30*24*60*60);
});
test.each(["/login","/auth/login","/auth/sign-up"])("%s skips sign-in for a valid session",async(path)=>{
 mocks.refresh=true;const response=await updateSession(request(path));
 expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
 expect(response.cookies.get("test-auth")?.value).toBe("test-refreshed-cookie");
 expect(response.headers.get("cache-control")).toContain("no-store");
});
test("signed-in invitation navigation keeps its intended destination",async()=>{
 const response=await updateSession(request("/login?redirect=%2Finvite%2Ftest-invitation"));
 expect(response.headers.get("location")).toBe("http://localhost:3000/invite/test-invitation");
});
test.each(["https://attacker.invalid","//attacker.invalid","/login?redirect=/login"])("unsafe or looping destination %s goes to dashboard",async(destination)=>{
 const response=await updateSession(request("/login?redirect="+encodeURIComponent(destination)));
 expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
});
test("signed-out users can visit public pages but must sign in to access the dashboard",async()=>{
 mocks.signedIn=false;
 for(const path of ["/","/docs","/login"])expect((await updateSession(request(path))).headers.get("location")).toBeNull();
 mocks.refresh=true;const response=await updateSession(request("/dashboard?tab=test"));
 expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
 expect(new URL(response.headers.get("location")!).searchParams.get("redirect")).toBe("/dashboard?tab=test");
 expect(response.cookies.get("test-auth")?.value).toBe("test-refreshed-cookie");
});
test("workspace switching keeps authentication cookies and cache headers",async()=>{
 mocks.refresh=true;const response=await updateSession(request("/dashboard/projects/20000000-0000-0000-0000-000000000021"));
 expect(response.cookies.get("shroud_workspace")?.value).toBe("test-team");
 expect(response.cookies.get("test-auth")?.value).toBe("test-refreshed-cookie");
 expect(response.headers.get("cache-control")).toContain("no-store");
});
