import ProjectContent from "../../project-content";
export default async function EnvironmentContent({params}:{params:Promise<{projectId:string;environmentId:string}>}) {
  return <ProjectContent params={params}/>;
}
