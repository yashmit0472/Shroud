import { Command } from "commander";
import { password } from "@inquirer/prompts";
import { saveToken } from "../lib/config.js";
import { getTeams } from "../lib/api.js";

export const loginCommand = new Command("login")
  .description("Authenticate the Shroud CLI")
  .argument("[token]", "API token (omit to enter it privately)")
  .action(async (argument?: string) => {
    try {
      if (!argument && !process.stdin.isTTY) throw new Error("Set SHROUD_TOKEN for CI/CD, or supply a token.");
      const token = argument ?? await password({ message: "Shroud API token:", mask: "*" });
      if (!/^shroud_[0-9a-f]{64}$/.test(token)) throw new Error("Invalid Shroud API token.");
      await getTeams(token);
      saveToken(token);
      console.log("Successfully logged in.");
    } catch (error) { console.error(error instanceof Error ? error.message : "Login failed"); process.exitCode = 1; }
  });
