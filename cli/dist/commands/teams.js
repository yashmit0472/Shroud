import { Command } from "commander";
import { getToken } from "../lib/config.js";
import { getTeams } from "../lib/api.js";
export const teamsCommand = new Command("teams")
    .description("List your Shroud teams")
    .action(async () => {
    const token = getToken();
    if (!token) {
        console.error("Not logged in. Run `shroud login <token>`.");
        process.exitCode = 1;
        return;
    }
    try {
        const teams = await getTeams(token);
        if (teams.length === 0) {
            console.log("No teams found.");
            return;
        }
        console.log("\nYour teams:\n");
        for (const team of teams) {
            console.log(`${team.name} (${team.slug}) — ${team.role}`);
        }
        console.log();
    }
    catch (error) {
        console.error(error instanceof Error
            ? error.message
            : "Failed to load teams.");
        process.exitCode = 1;
    }
});
