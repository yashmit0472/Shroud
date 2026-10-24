import { parseBrowserEnv } from "@/lib/browser-cli";
export function previewEnvImport(content:string,existingKeys:string[]){
  if(new TextEncoder().encode(content).length>1048576)throw new Error("The input must be smaller than 1 MB.");
  const entries=parseBrowserEnv(content);
  if(!entries.length||entries.length>500)throw new Error("Paste between 1 and 500 variables.");
  return entries.map(entry=>({...entry,action:existingKeys.includes(entry.key)?"Update":"Create"}));
}
