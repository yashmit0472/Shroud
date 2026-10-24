import { Command } from "commander";
import fs from "fs";
import { createSecret } from "../lib/api.js";
import { getToken } from "../lib/config.js";
import { parseEnvFile } from "../lib/env-file.js";
import { selectEnvironment } from "../lib/selection.js";
export const pushCommand = new Command("push")
    .description("Push environment variables from .env to Shroud")
    .option("-p, --project <id-or-slug>", "Project ID or slug")
    .option("-e, --environment <id-or-slug>", "Environment ID, slug, or type")
    .option("-f, --file <path>", "Input file", ".env")
    .option("--confirm-production", "Confirm Production writes (required for Production)")
    .action(async (options) => {
    let pushed = 0;
    let queued = 0;
    try {
        const token = getToken();
        if (!token)
            throw new Error("Not logged in. Run shroud login or set SHROUD_TOKEN.");
        const variables = parseEnvFile(fs.readFileSync(options.file, "utf8"));
        if (!variables.length)
            throw new Error("No environment variables found in the input file.");
        const { projectId, environmentId } = await selectEnvironment(token, options);
        for (const variable of variables) {
            const result = await createSecret(token, projectId, environmentId, variable, options.confirmProduction === true);
            if (result.pending) {
                queued++;
                console.log(variable.key + " → awaiting Production approval (" + result.request_id + ")");
                continue;
            }
            pushed++;
            console.log(variable.key + " → version " + (result.secret?.version ?? 1));
        }
        console.log("Successfully pushed " + pushed + " environment variables.");
        if (queued)
            console.log(queued + " variables are awaiting approval in project Activity.");
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : "Failed to push secrets");
        if (pushed)
            console.error(pushed + " variables were already pushed before this failure.");
        process.exitCode = 1;
    }
});
