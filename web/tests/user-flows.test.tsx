import React from "react";
import { beforeEach,expect,test,vi } from "vitest";
import { act,fireEvent,render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/login-form";
import { CreateProjectForm } from "@/app/dashboard/projects/new/create-project-form";
import { TeamMembers } from "@/components/team-members";
import { WorkspaceMenu } from "@/components/workspace-menu";
import { SecretReveal } from "@/components/secret-reveal";
import { useSecretMutation } from "@/components/use-secret-mutation";
import { BulkEnvDialog } from "@/components/bulk-env-dialog";

const mocks=vi.hoisted(()=>({router:{push:vi.fn(),replace:vi.fn(),refresh:vi.fn()},password:vi.fn(),oauth:vi.fn(),fetch:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>mocks.router,usePathname:()=>"/dashboard",useSearchParams:()=>new URLSearchParams(window.location.search)}));
vi.mock("@/lib/supabase/client",()=>({createClient:()=>({auth:{signInWithPassword:mocks.password,signInWithOAuth:mocks.oauth}})}));
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal("fetch",mocks.fetch);mocks.password.mockResolvedValue({error:null});mocks.oauth.mockResolvedValue({error:null});
 window.history.replaceState({},"","/login");
 Object.defineProperty(HTMLElement.prototype,"setPointerCapture",{configurable:true,value:vi.fn()});
});
test("email/password sign-in submits credentials and preserves an invitation destination",async()=>{
 window.history.replaceState({},"","/login?redirect=/invite/test-invite");const user=userEvent.setup();render(<LoginForm/>);
 await user.type(screen.getByLabelText("Email address"),"test@example.invalid");await user.type(screen.getByLabelText(/Password/),"test-only-password");await user.click(screen.getByRole("button",{name:/Sign in with email/}));
 await waitFor(()=>expect(mocks.password).toHaveBeenCalledWith({email:"test@example.invalid",password:"test-only-password"}));
 expect(mocks.router.replace).toHaveBeenCalledWith("/invite/test-invite");
});
test("Google sign-in keeps the callback on the local application",async()=>{
 const user=userEvent.setup();render(<LoginForm/>);await user.click(screen.getByRole("button",{name:/Continue with Google/}));
 expect(mocks.oauth).toHaveBeenCalledWith({provider:"google",options:{redirectTo:"http://localhost:3000/auth/callback?next=%2Fonboarding"}});
});
test("project creation submits once and navigates to the returned project",async()=>{
 const id="20000000-0000-0000-0000-000000000021";mocks.fetch.mockResolvedValue(json({project_id:id}));
 const user=userEvent.setup();render(<CreateProjectForm teamId="team-a"/>);
 await user.type(screen.getByLabelText(/Project name/),"API");await user.click(screen.getByRole("button",{name:"Create project"}));
 await waitFor(()=>expect(mocks.router.push).toHaveBeenCalledWith("/dashboard/projects/"+id));
 expect(mocks.fetch).toHaveBeenCalledTimes(1);
 expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({team_id:"team-a",name:"API"});
});
test("workspace switching calls the API and refreshes the selected workspace",async()=>{
 mocks.fetch.mockResolvedValue(json({success:true}));const user=userEvent.setup();
 render(<WorkspaceMenu active="a" workspaces={[{id:"a",name:"First",slug:"first",role:"owner"},{id:"b",name:"Second",slug:"second",role:"viewer"}]}/>);
 await user.click(screen.getByRole("button",{name:"Switch workspace"}));await user.click(await screen.findByText("Second"));
 await waitFor(()=>expect(mocks.router.refresh).toHaveBeenCalled());
 expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({team_id:"b"});
});
test("invitation credentials remain visible after the member list refreshes",async()=>{
 mocks.fetch.mockImplementation(async(_url:string,options?:RequestInit)=>options?.method==="POST"?json({invitation:{token:"test-only-invite-token",invite_code:"TESTCODE"}}):json({members:[],invitations:[]}));
 const user=userEvent.setup();render(<TeamMembers teamId="team" currentUserId="owner" currentUserRole="owner"/>);
 await user.click(await screen.findByRole("button",{name:"Create invitation link"}));await user.click(screen.getByRole("button",{name:"Create invitation"}));
 await screen.findByDisplayValue("test-only-invite-token");
 expect(screen.getByDisplayValue("http://localhost:3000/invite/test-only-invite-token")).toBeTruthy();
});
test("holding Space reveals a value and releasing it removes the value immediately",async()=>{
 mocks.fetch.mockResolvedValue(json({items:[{key:"KEY",value:"test-only-value"}]}));render(<aside><SecretReveal projectId="project" environmentId="env" secretKey="KEY" production={false}/></aside>);
 const button=screen.getByRole("button",{name:"Hold to reveal secret"});button.focus();fireEvent.keyDown(button,{code:"Space",key:" "});
 await screen.findByText("test-only-value");fireEvent.keyUp(window,{code:"Space",key:" "});
 expect(screen.queryByText("test-only-value")).toBeNull();
});
test("Production reveal requires the modifier and discards a late response after release",async()=>{
 let resolve!:(response:Response)=>void;mocks.fetch.mockImplementation(()=>new Promise<Response>(done=>{resolve=done;}));
 render(<aside><SecretReveal projectId="project" environmentId="env" secretKey="KEY" production/></aside>);
 const button=screen.getByRole("button",{name:"Hold to reveal secret"});button.focus();fireEvent.keyDown(button,{code:"Space",key:" "});expect(mocks.fetch).not.toHaveBeenCalled();
 fireEvent.keyDown(button,{code:"Space",key:" ",ctrlKey:true});expect(mocks.fetch).toHaveBeenCalledTimes(1);
 fireEvent.keyUp(window,{code:"Space",key:" "});
 await act(async()=>resolve(json({items:[{key:"KEY",value:"late-test-only-value"}]})));
 expect(screen.queryByText("late-test-only-value")).toBeNull();
});
function ProductionHarness(){
 const mutation=useSecretMutation();return <>{mutation.confirmation}<button onClick={()=>void mutation.request("/change",{method:"POST",body:JSON.stringify({key:"KEY"})})}>Save change</button></>;
}
test("Production writes retry only after explicit confirmation",async()=>{
 mocks.fetch.mockResolvedValueOnce(json({code:"P0400"},409)).mockResolvedValueOnce(json({count:1}));
 const user=userEvent.setup();render(<ProductionHarness/>);await user.click(screen.getByText("Save change"));
 const confirm=await screen.findByRole("button",{name:"Confirm Production"});expect((confirm as HTMLButtonElement).disabled).toBe(true);expect(mocks.fetch).toHaveBeenCalledTimes(1);
 await user.type(screen.getByLabelText("Type Production to continue"),"Production");await user.click(confirm);
 await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledTimes(2));
 expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({key:"KEY",confirm_production:true});
});
test("bulk import previews keys without showing values, then saves only after confirmation",async()=>{
 mocks.fetch.mockResolvedValueOnce(json({changes:[{key:"API_KEY",action:"Create"}],count:1,plan:"test-plan"})).mockResolvedValueOnce(json({pending:false,count:1}));
 const user=userEvent.setup(),close=vi.fn();render(<BulkEnvDialog projectId="project" environment={{id:"env",name:"Development",type:"development"}} mode="import" onClose={close}/>);
 await user.type(screen.getByLabelText("Environment file contents"),"API_KEY=test-only-private-value");
 await user.click(screen.getByRole("button",{name:"Preview changes"}));await screen.findByText("API_KEY");
 expect(screen.queryByText("test-only-private-value")).toBeNull();expect(mocks.fetch).toHaveBeenCalledTimes(1);
 await user.click(screen.getByRole("button",{name:"Confirm import"}));await waitFor(()=>expect(close).toHaveBeenCalled());
 expect(JSON.parse(mocks.fetch.mock.calls[1][1].body).confirm_import).toBe(true);
});
