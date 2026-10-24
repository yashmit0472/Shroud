import {beforeEach,expect,test,vi} from "vitest";
const mocks=vi.hoisted(()=>({workspace:vi.fn(),active:vi.fn(),access:vi.fn()}));
vi.mock("@/lib/workspace-context",()=>({getWorkspaceContext:mocks.workspace,isActiveWorkspaceProject:mocks.active}));
vi.mock("@/lib/workspace-access",()=>({projectAccess:mocks.access,canWrite:(role:string)=>["owner","admin","developer"].includes(role),canManage:(role:string)=>["owner","admin"].includes(role)}));
import {GET as search} from "@/app/api/search/route";
import {GET as fingerprints} from "@/app/api/projects/[projectId]/fingerprints/route";
import {POST as bulk} from "@/app/api/projects/[projectId]/bulk/route";
import {POST as vercel} from "@/app/api/projects/[projectId]/vercel/route";
import {encryptSecret} from "@/lib/crypto";
import {vercelRequest} from "@/lib/vercel";
beforeEach(()=>{vi.stubEnv("SHROUD_ENCRYPTION_KEY",Buffer.alloc(32,7).toString("base64"));mocks.active.mockResolvedValue(true);});
const context={params:Promise.resolve({projectId:"project-a"})};
test("search scopes memberships and workspace and selects only names and locations",async()=>{
 const selected:string[]=[];const constraints:unknown[]=[];
 const records:Record<string,unknown[]>={project_members:[{project_id:"project-a"}],projects:[{id:"project-a",name:"API",slug:"api"}],environments:[{id:"env-a",name:"Development",project_id:"project-a",slug:"development"}],secrets:[{id:"secret-a",key:"API_KEY",environment_id:"env-a"}]};
 mocks.workspace.mockResolvedValue({userId:"user-a",workspace:{id:"team-a"},supabase:{from:(table:string)=>{const chain={select:(columns:string)=>{selected.push(table+":"+columns);return chain;},eq:(...args:unknown[])=>{constraints.push(args);return chain;},in:(...args:unknown[])=>{constraints.push(args);return chain;},ilike:(...args:unknown[])=>{constraints.push(args);return chain;},order:()=>chain,limit:()=>chain,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:records[table],error:null}).then(resolve)};return chain;}}});
 const response=await search(new Request("http://localhost:3000/api/search?q=API_"));
 expect(response.status).toBe(200);expect(selected).toContain("secrets:id,key,environment_id");expect(selected.join(" ")).not.toMatch(/value|secret_versions/);expect(constraints).toContainEqual(["team_id","team-a"]);expect(constraints).toContainEqual(["key","%API\\_%"]);expect(response.headers.get("cache-control")).toBe("no-store");
});
test("comparison returns keyed fingerprints without plaintext or ciphertext",async()=>{
 const ciphertext=encryptSecret("test-only-private-value").encryptedValue;
 mocks.access.mockResolvedValue({status:200,supabase:{rpc:vi.fn().mockResolvedValue({data:[{secret_id:"a",key:"KEY",environment_id:"dev",encrypted_value:ciphertext},{secret_id:"b",key:"KEY",environment_id:"prod",encrypted_value:encryptSecret("another-test-value").encryptedValue}],error:null})}});
 const response=await fingerprints(new Request("http://localhost:3000"),context),text=await response.text();
 expect(text).not.toContain("test-only-private-value");expect(text).not.toContain(ciphertext);expect(JSON.parse(text).entries.map((entry:{state:string})=>entry.state)).toEqual(["matching","different"]);
 mocks.access.mockResolvedValue({status:403});expect((await fingerprints(new Request("http://localhost:3000"),context)).status).toBe(403);
});
test("bulk preview hides values and invalidates confirmation after a source change",async()=>{
 let currentCipher="test-cipher-one";const rpc=vi.fn().mockImplementation(()=>Promise.resolve({data:[{key:"KEY",environment_id:"env-a",encrypted_value:currentCipher}],error:null}));
 mocks.access.mockResolvedValue({status:200,role:"developer",supabase:{rpc,from:()=>({select:()=>({eq:()=>Promise.resolve({data:[{id:"a",key:"KEY",updated_at:"fixed-date"}],error:null})})})}});
 const send=(body:unknown)=>bulk(new Request("http://localhost:3000/api/projects/project-a/bulk",{method:"POST",headers:{origin:"http://localhost:3000"},body:JSON.stringify(body)}),context);
 const input={environment_id:"env-a",content:"KEY=test-only-private-value"};
 const preview=await send({...input,preview:true}),data=await preview.json();expect(JSON.stringify(data)).not.toContain("test-only-private-value");expect(data.changes).toEqual([{key:"KEY",action:"Update"}]);
 currentCipher="test-cipher-two";expect((await send({...input,confirm_import:true,plan:data.plan})).status).toBe(409);expect(rpc.mock.calls.every(call=>call[0]==="shroud_project_ciphertexts")).toBe(true);
});
test("Vercel requests always use the provider host and reject redirects",async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response("{}"));vi.stubGlobal("fetch",fetch);
 await vercelRequest("../../different-host","team-a","test-token","POST",[{key:"KEY",value:"test-value"}]);
 const [url,options]=fetch.mock.calls[0];expect(url.origin).toBe("https://api.vercel.com");expect(url.searchParams.get("upsert")).toBe("true");expect(options.redirect).toBe("error");expect(options.cache).toBe("no-store");
});
test("Vercel preview hides values and Production sync requires confirmation",async()=>{
 const rpc=vi.fn().mockImplementation((name:string)=>Promise.resolve({error:null,data:name==="shroud_vercel_credentials"?[{vercel_project_id:"prj_test",vercel_team_id:null,encrypted_token:encryptSecret("test-token").encryptedValue}]:name==="shroud_browser_pull"?[{key:"KEY",encrypted_value:encryptSecret("test-only-private-value").encryptedValue}]:true}));
 // Keep ciphertext stable between preview and confirmation, just as stored rows are.
 const connection={vercel_project_id:"prj_test",vercel_team_id:null,encrypted_token:encryptSecret("test-token").encryptedValue},values=[{key:"KEY",encrypted_value:encryptSecret("test-only-private-value").encryptedValue}];
 rpc.mockImplementation((name:string)=>Promise.resolve({error:null,data:name==="shroud_vercel_credentials"?[connection]:name==="shroud_browser_pull"?values:true}));
 mocks.access.mockResolvedValue({status:200,role:"owner",supabase:{rpc,from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:()=>Promise.resolve({data:{id:"env-a",name:"Development",type:"development"}})})})})})}});
 const fetch=vi.fn().mockResolvedValue(new Response('{"error":"test-only-private-provider-response"}',{status:403}));vi.stubGlobal("fetch",fetch);
 const send=(body:unknown)=>vercel(new Request("http://localhost:3000/api/projects/project-a/vercel",{method:"POST",headers:{origin:"http://localhost:3000"},body:JSON.stringify(body)}),context),input={action:"sync",environment_id:"env-a",target:"production"};
 const preview=await (await send({...input,preview:true})).json();expect(JSON.stringify(preview)).not.toContain("test-only-private-value");expect(fetch).not.toHaveBeenCalled();
 const unconfirmed=await send({...input,plan:preview.plan,confirm_sync:true});expect(unconfirmed.status).toBe(409);expect((await unconfirmed.json()).code).toBe("P0400");expect(fetch).not.toHaveBeenCalled();
 const response=await send({...input,plan:preview.plan,confirm_sync:true,confirm_production:true});expect(response.status).toBe(502);expect(await response.text()).not.toContain("test-only-private-provider-response");
 const posted=JSON.parse(fetch.mock.calls[0][1].body);expect(posted[0]).toMatchObject({type:"sensitive",visibility:"secret",target:["production"]});
});
