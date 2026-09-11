import { Command } from "commander";
import { saveToken } from "../lib/config.js";

export const loginCommand = new Command("login")
    .description("Authenticate the Shroud CLI")
    .argument("<token>", "Shroud API token")
    .action((token: string) => {
        if (!token.startsWith("shroud_")) {
            console.error("Invalid Shroud API token.");
            process.exitCode = 1;
            return;
        }

        saveToken(token);

        console.log("Successfully logged in.");
    });
