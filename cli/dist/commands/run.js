import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { spawn } from "child_process";
import { getProjects, getEnvironments, getAllSecretValuesBulk, } from "../lib/api.js";
import { getToken } from "../lib/config.js";
export const runCommand = new Command("run")
    .description("Run a command with Shroud environment variables")
    .argument("<command...>", "Command to execute")
    .action(async (commandArgs) => {
    const token = getToken();
    if (!token) {
        console.error("Not logged in. Run `shroud login <token>`.");
        process.exitCode = 1;
        return;
    }
    if (commandArgs.length === 0) {
        console.error("No command provided.");
        process.exitCode = 1;
        return;
    }
    try {
        /*
         * --------------------------------------------------
         * Select project
         * --------------------------------------------------
         */
        const projects = await getProjects(token);
        if (projects.length === 0) {
            console.error("No projects found.");
            return;
        }
        const projectId = await select({
            message: "Select a project:",
            choices: projects.map((project) => ({
                name: project.name,
                value: project.id,
            })),
        });
        /*
         * --------------------------------------------------
         * Select environment
         * --------------------------------------------------
         */
        const environments = await getEnvironments(token, projectId);
        if (environments.length === 0) {
            console.error("No environments found.");
            return;
        }
        const environmentId = await select({
            message: "Select an environment:",
            choices: environments.map((environment) => ({
                name: `${environment.name} (${environment.type})`,
                value: environment.id,
            })),
        });
        /*
         * --------------------------------------------------
         * Fetch secrets
         * --------------------------------------------------
         */
        const secrets = await getAllSecretValuesBulk(token, projectId, environmentId);
        /*
         * --------------------------------------------------
         * Build child process environment
         * --------------------------------------------------
         */
        const environment = {
            ...process.env,
        };
        for (const secret of secrets) {
            environment[secret.key] = secret.value;
        }
        /*
         * --------------------------------------------------
         * Execute command
         * --------------------------------------------------
         */
        const command = commandArgs[0];
        const args = commandArgs.slice(1);
        console.log(`Running ${commandArgs.join(" ")} with ${secrets.length} Shroud environment variables...\n`);
        const child = spawn(command, args, {
            stdio: "inherit",
            env: environment,
            shell: process.platform === "win32",
        });
        child.on("error", (error) => {
            console.error(`Failed to start command: ${error.message}`);
            process.exitCode = 1;
        });
        child.on("exit", (code, signal) => {
            if (signal) {
                process.exitCode = 1;
                return;
            }
            process.exitCode = code ?? 1;
        });
    }
    catch (error) {
        console.error(error instanceof Error
            ? error.message
            : "Failed to run command.");
        process.exitCode = 1;
    }
});
