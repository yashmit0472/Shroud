import { Command } from "commander";
import { confirm, select } from "@inquirer/prompts";
import {
    getProjects,
    getEnvironments,
    getSecrets,
    getSecretValue,
} from "../lib/api.js";
import { getToken } from "../lib/config.js";
import fs from "fs";

export const pullCommand = new Command("pull")
    .description("Pull environment variables into a .env file")
    .action(async () => {
        const token = getToken();

        if (!token) {
            console.error("Not logged in. Run `shroud login <token>`.");
            process.exitCode = 1;
            return;
        }

        try {
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

            const environments = await getEnvironments(
                token,
                projectId,
            );

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

            const secrets = await getSecrets(
                token,
                projectId,
                environmentId,
            );

            if (secrets.length === 0) {
                console.log("No environment variables found.");
                return;
            }

            const values = await Promise.all(
                secrets.map((secret) =>
                    getSecretValue(
                        token,
                        projectId,
                        environmentId,
                        secret.id,
                    ),
                ),
            );

            const envContent = values
                .map((secret) => `${secret.key}=${secret.value}`)
                .join("\n");

            if (fs.existsSync(".env")) {
                const overwrite = await confirm({
                    message: ".env already exists. Overwrite it?",
                    default: false,
                });

                if (!overwrite) {
                    console.log("Pull cancelled.");
                    return;
                }
            }

            fs.writeFileSync(".env", `${envContent}\n`, "utf8");

            console.log(
                `Successfully pulled ${values.length} environment variables into .env`,
            );
        } catch (error) {
            console.error(
                error instanceof Error
                    ? error.message
                    : "Failed to pull environment variables.",
            );

            process.exitCode = 1;
        }
    });
