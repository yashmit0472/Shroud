import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { whoamiCommand } from "./commands/whoami.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";
import { runCommand } from "./commands/run.js";
import { teamsCommand } from "./commands/teams.js";
const program = new Command();
program
    .name("shroud")
    .description("Secure environment variable management for developers")
    .version("0.1.0");
program.addCommand(loginCommand);
program.addCommand(whoamiCommand);
program.addCommand(pullCommand);
program.addCommand(pushCommand);
program.addCommand(runCommand);
program.addCommand(teamsCommand);
program.parseAsync();
