import { Command } from "commander";
import fs from "fs";
import { createSecret } from "../lib/api.js";
import { getToken } from "../lib/config.js";
import { parseEnvFile } from "../lib/env-file.js";
import { selectEnvironment, type SelectionOptions } from "../lib/selection.js";

export const pushCommand = new Command("push")
  .description("Push environment variables from .env to Shroud")
  .option("-p, --project <id-or-slug>", "Project ID or slug")
  .option("-e, --environment <id-or-slug>", "Environment ID, slug, or type")
  .option("-f, --file <path>", "Input file", ".env")
  .action(async (options: SelectionOptions & { file: string }) => {
    let pushed = 0;
    try {
      const token = getToken();
      if (!token) throw new Error("Not logged in. Run shroud login or set SHROUD_TOKEN.");
      const variables = parseEnvFile(fs.readFileSync(options.file, "utf8"));
      if (!variables.length) throw new Error("No environment variables found in the input file.");
      const { projectId, environmentId } = await selectEnvironment(token, options);
      for (const variable of variables) {
        const result = await createSecret(token, projectId, environmentId, variable);
        pushed++;
        console.log(variable.key + " → version " + (result.secret?.version ?? 1));
      }
      console.log("Successfully pushed " + pushed + " environment variables.");
    } catch (error) { console.error(error instanceof Error ? error.message : "Failed to push secrets"); if (pushed) console.error(pushed + " variables were already pushed before this failure."); process.exitCode = 1; }
  });
