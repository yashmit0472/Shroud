import { Command } from "commander";
import { getToken } from "../lib/config.js";
import { ShroudApiError } from "../lib/api.js";
export const whoamiCommand = new Command("whoami")
    .description("Verify Shroud CLI authentication")
    .action(async () => {
    const token = getToken();
    if (!token) {
        console.error("Not logged in. Run `shroud login <token>`.");
        process.exitCode = 1;
        return;
    }
    try {
        const response = await fetch(`${process.env.SHROUD_API_URL ?? "http://localhost:3000"}/api/v1/auth/test`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await response.json();
        if (!response.ok) {
            throw new ShroudApiError(data.error ?? "Authentication failed", response.status);
        }
        console.log("Authenticated successfully.");
        console.log(`Team: ${data.team_id}`);
    }
    catch (error) {
        if (error instanceof ShroudApiError) {
            console.error(error.message);
        }
        else {
            console.error("Unable to connect to Shroud API.");
        }
        process.exitCode = 1;
    }
});
