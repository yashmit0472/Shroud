export const vercelTargets=["development","preview","production"] as const;
export async function vercelRequest(project:string,team:string|null,token:string,method:"GET"|"POST",body?:unknown) {
 const url=new URL(method==="GET"?"/v9/projects/"+encodeURIComponent(project):"/v10/projects/"+encodeURIComponent(project)+"/env","https://api.vercel.com");
 if(team)url.searchParams.set("teamId",team);
 if(method==="POST")url.searchParams.set("upsert","true");
 return fetch(url,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(20000)});
}
