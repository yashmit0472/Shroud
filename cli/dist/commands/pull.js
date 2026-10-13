import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import fs from "fs";
import { getAllSecretValuesBulk } from "../lib/api.js";
import { getToken } from "../lib/config.js";
import { serializeEnvFile } from "../lib/env-file.js";
import { selectEnvironment } from "../lib/selection.js";
export const pullCommand = new Command("pull")
    .description("Pull environment variables into a .env file")
    .option("-p, --project <id-or-slug>", "Project ID or slug")
    .option("-e, --environment <id-or-slug>", "Environment ID, slug, or type")
    .option("-f, --file <path>", "Output file", ".env")
    .option("--force", "Overwrite an existing file")
    .action(async (options) => {
    try {
        const token = getToken();
        if (!token)
            throw new Error("Not logged in. Run shroud login or set SHROUD_TOKEN.");
        let overwrite = Boolean(options.force);
        if (fs.existsSync(options.file)) {
            if (fs.lstatSync(options.file).isSymbolicLink())
                throw new Error("Refusing to write secrets through a symbolic link.");
            if (!overwrite) {
                if (!process.stdin.isTTY)
                    throw new Error("Output exists. Use --force to overwrite it.");
                overwrite = await confirm({ message: options.file + " already exists. Overwrite it?", default: false });
                if (!overwrite) {
                    console.log("Pull cancelled.");
                    return;
                }
            }
        }
        const { projectId, environmentId } = await selectEnvironment(token, options);
        const values = await getAllSecretValuesBulk(token, projectId, environmentId);
        if (!values.length) {
            console.log("No environment variables found. The output file was left unchanged.");
            return;
        }
        const content = serializeEnvFile(values);
        const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | (overwrite ? fs.constants.O_TRUNC : fs.constants.O_EXCL) | (fs.constants.O_NOFOLLOW ?? 0);
        const fd = fs.openSync(options.file, flags, 0o600);
        try {
            if (process.platform !== "win32")
                fs.fchmodSync(fd, 0o600);
            fs.writeFileSync(fd, content, "utf8");
        }
        finally {
            fs.closeSync(fd);
        }
        console.log("Successfully pulled " + values.length + " environment variables into " + options.file);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : "Failed to pull secrets");
        process.exitCode = 1;
    }
});
