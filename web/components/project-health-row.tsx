import Link from "next/link";
import { Folder, ArrowUpRight, Lock } from "lucide-react";

export type HealthEnvironment = { id:string; name:string; type:string; present:number; total:number; missing:number };
export function ProjectHealthRow({ project, environments, accessible }: { project:{id:string;name:string;description:string|null}; environments:HealthEnvironment[] | null; accessible:boolean }) {
  return <article className="health-project">
    <div className="health-project-header"><span className="flex min-w-0 items-center gap-9"><Folder size={17} className="text-muted-foreground" />{accessible ? <Link className="text-[13px] font-medium hover:text-primary" href={"/dashboard/projects/" + project.id}>{project.name}</Link> : <span className="text-[13px]">{project.name}</span>}</span>{accessible ? <Link href={"/dashboard/projects/" + project.id} aria-label={"Open " + project.name} className="icon-button"><ArrowUpRight size={14} /></Link> : <span className="flex items-center gap-2 text-[10px] text-amber-300"><Lock size={11} />Access required</span>}</div>
    {!accessible ? <p className="text-xs text-muted-foreground">Ask a project owner or admin to add your account.</p> : environments === null ? <p className="text-xs text-muted-foreground">Configuration health is unavailable.</p> : !environments.length ? <p className="text-xs text-muted-foreground">No environments in this project.</p> : environments.map(environment => <div key={environment.id} className="health-line">
      <Link href={"/dashboard/projects/" + project.id + "/environments/" + environment.id} className="health-environment hover:text-foreground"><i className={"dot " + environment.type} />{environment.name}</Link>
      <div className={"health-track" + (environment.missing ? " issue" : "")}><span style={{width:(environment.total ? Math.min(100,environment.present/environment.total*100) : 0) + "%"}} /></div>
      <span className="font-mono text-[10px] text-muted-foreground">{environment.present} / {environment.total}</span><span className={environment.missing ? "text-[10px] text-destructive" : "text-[10px] text-muted-foreground"}>{environment.missing ? environment.missing + " missing" : environment.total ? "" : "No keys yet"}</span>
    </div>)}
  </article>;
}
