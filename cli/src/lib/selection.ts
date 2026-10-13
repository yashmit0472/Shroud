import { select } from "@inquirer/prompts";
import { getProjects, getEnvironments } from "./api.js";

export type SelectionOptions = { project?: string; environment?: string };
export async function selectEnvironment(token: string, options: SelectionOptions) {
  const projects = await getProjects(token);
  if (!projects.length) throw new Error("No projects found. Create a project in the dashboard.");
  const requestedProject = options.project ?? process.env.SHROUD_PROJECT;
  const project = requestedProject ? projects.find((entry) => entry.id === requestedProject || entry.slug === requestedProject) : null;
  if (requestedProject && !project) throw new Error("Project was not found or is not accessible.");
  if (!project && !process.stdin.isTTY) throw new Error("Specify --project or SHROUD_PROJECT for noninteractive usage.");
  const projectId = project?.id ?? await select({ message: "Select a project:", choices: projects.map((entry) => ({ name: entry.name, value: entry.id })) });
  const environments = await getEnvironments(token, projectId);
  if (!environments.length) throw new Error("No environments found.");
  const requestedEnvironment = options.environment ?? process.env.SHROUD_ENVIRONMENT;
  const environment = requestedEnvironment ? environments.find((entry) => entry.id === requestedEnvironment || entry.slug === requestedEnvironment || entry.type === requestedEnvironment) : null;
  if (requestedEnvironment && !environment) throw new Error("Environment was not found in this project.");
  if (!environment && !process.stdin.isTTY) throw new Error("Specify --environment or SHROUD_ENVIRONMENT for noninteractive usage.");
  const environmentId = environment?.id ?? await select({ message: "Select an environment:", choices: environments.map((entry) => ({ name: `${entry.name} (${entry.type})`, value: entry.id })) });
  return { projectId, environmentId };
}
