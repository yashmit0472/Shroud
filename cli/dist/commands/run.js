import { Command } from "commander";
import { spawn } from "child_process";
import { getAllSecretValuesBulk } from "../lib/api.js";
import { getToken } from "../lib/config.js";
import { selectEnvironment } from "../lib/selection.js";
export const runCommand = new Command("run")
    .description("Run a command with Shroud environment variables")
    .option("-p, --project <id-or-slug>", "Project ID or slug")
    .option("-e, --environment <id-or-slug>", "Environment ID, slug, or type")
    .argument("<command...>", "Command to execute (use -- before its arguments)")
    .action(async (commandArgs, options) => {
    try {
        const token = getToken();
        if (!token)
            throw new Error("Not logged in. Run shroud login or set SHROUD_TOKEN.");
        const { projectId, environmentId } = await selectEnvironment(token, options);
        const secrets = await getAllSecretValuesBulk(token, projectId, environmentId);
        const environment = { ...process.env };
        // Keep the CLI credential out of child processes.
        delete environment.SHROUD_TOKEN;
        for (const secret of secrets) {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(secret.key) || secret.value.includes("\0"))
                throw new Error("Server returned an invalid environment variable");
            environment[secret.key] = secret.value;
        }
        const child = spawn(commandArgs[0], commandArgs.slice(1), {
            stdio: "inherit", env: environment, shell: false,
        });
        const forward = (signal) => { if (!child.killed)
            child.kill(signal); };
        const onInterrupt = () => forward("SIGINT");
        const onTerminate = () => forward("SIGTERM");
        process.on("SIGINT", onInterrupt);
        process.on("SIGTERM", onTerminate);
        await new Promise((resolve) => {
            child.once("error", () => { console.error("Failed to start command. Check the executable and arguments."); process.exitCode = 1; resolve(); });
            child.once("exit", (code, signal) => { process.exitCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : code ?? 1; resolve(); });
        });
        process.removeListener("SIGINT", onInterrupt);
        process.removeListener("SIGTERM", onTerminate);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : "Failed to run command");
        process.exitCode = 1;
    }
});
