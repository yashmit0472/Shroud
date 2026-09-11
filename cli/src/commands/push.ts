import { Command } from "commander";
import { select } from "@inquirer/prompts";
import fs from "fs";
import {
    getProjects,
    getEnvironments,
    createSecret,
} from "../lib/api.js";
import { getToken } from "../lib/config.js";

function parseEnvFile(content: string) {
    const variables: { key: string; value: string }[] = [];

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separator = trimmed.indexOf("=");

        if (separator === -1) {
            continue;
        }

        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1);

        if (
            value.startsWith('"') &&
            value.endsWith('"')
        ) {
            value = value.slice(1, -1);
        } else if (
            value.startsWith("'") &&
            value.endsWith("'")
        ) {
            value = value.slice(1, -1);
        }

        if (key) {
            variables.push({ key, value });
        }
    }

    return variables;
}

export const pushCommand = new Command("push")
    .description("Push environment variables from .env to Shroud")
    .action(async () => {
        const token = getToken();

        if (!token) {
            console.error(
                "Not logged in. Run `shroud login <token>`.",
            );
            process.exitCode = 1;
            return;
        }

        if (!fs.existsSync(".env")) {
            console.error("No .env file found.");
            process.exitCode = 1;
            return;
        }

        const content = fs.readFileSync(".env", "utf8");
        const variables = parseEnvFile(content);

        if (variables.length === 0) {
            console.error("No environment variables found in .env.");
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

            console.log(
                `Pushing ${variables.length} environment variables...`,
            );

            for (const variable of variables) {
                const result = await createSecret(
                    token,
                    projectId,
                    environmentId,
                    {
                        key: variable.key,
                        value: variable.value,
                    },
                );

                const version = result.secret?.version ?? 1;

                console.log(
                    `✓ ${variable.key} → version ${version}`,
                );
            }

            console.log(
                `Successfully pushed ${variables.length} environment variables.`,
            );
        } catch (error) {
            console.error(
                error instanceof Error
                    ? error.message
                    : "Failed to push environment variables.",
            );

            process.exitCode = 1;
        }
    });
