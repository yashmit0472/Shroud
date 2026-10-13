export const terminalHelp = [
  "Shroud browser terminal — no installation or API token required",
  "",
  "shroud projects                  List accessible projects",
  "shroud use <project>             Enter a project by ID, slug, or quoted name",
  "shroud cd <project>              Alias for use; cd .. leaves the project",
  "shroud environments              List environments in the current project",
  "shroud env <environment>         Enter Development, Staging, or Production",
  "shroud secrets                   List keys in the current environment",
  "shroud secrets --values          Show all keys and their values",
  "shroud pull <KEY>                Show one variable's value",
  'shroud push <KEY> "<VALUE>"       Add or update one variable',
  'shroud push <KEY>=<VALUE>         Alternate syntax; KEY= saves an empty value',
  "shroud whoami / shroud teams      Show account or teams",
  "help / clear                     Show commands or clear terminal history",
  "",
  "Start: shroud projects → shroud use my-project → shroud env development",
  'Example: shroud push DATABASE_URL "postgres://host/database"',
  "Values are literal: no shell execution or variable expansion.",
  "Push values are redacted from output and excluded from command recall.",
].join("\n");

export type BrowserCommand = {
  action: string;
  project?: string;
  environment?: string;
  key?: string;
  value?: string;
  showValues?: boolean;
};

function literalArgument(input: string): string {
  if (!input.startsWith('"') && !input.startsWith("'")) return input;
  const quote = input[0];
  let end = -1;
  for (let index = 1; index < input.length; index++) {
    if (quote === '"' && input[index] === "\\") {
      if (input[index + 1] === '"' || input[index + 1] === "\\") { index++; continue; }
    }
    if (input[index] === quote) { end = index; break; }
  }
  if (end < 0 || input.slice(end + 1).trim()) throw new Error("Close the quoted value and do not add arguments after it.");
  const value = input.slice(1, end);
  return quote === '"' ? value.replace(/\\(["\\])/g, "$1") : value;
}

export function parseBrowserCommand(input: string): BrowserCommand {
  const trimmed = input.trim().replace(/^shroud(?:\s+|$)/, "");
  const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  const requested = match?.[1] ?? "help";
  const action = requested === "--help" || requested === "-h" ? "help" : requested === "cd" ? "use" : requested;
  const argumentsText = match?.[2] ?? "";
  if (["help", "clear", "whoami", "teams", "projects", "environments"].includes(action)) {
    if (argumentsText) throw new Error("This command does not accept arguments.");
    return { action };
  }
  if (action === "use" || action === "env") {
    if (!argumentsText) throw new Error(action === "use" ? "Use: shroud use <project>" : "Use: shroud env <environment>");
    const value = literalArgument(argumentsText);
    if (!value || (!argumentsText.startsWith('"') && !argumentsText.startsWith("'") && /\s/.test(value))) throw new Error("Use an ID, slug, or a name in quotes.");
    return action === "use" ? { action, project: value } : { action, environment: value };
  }
  if (action === "secrets") {
    if (argumentsText && argumentsText !== "--values") throw new Error("Use: shroud secrets [--values]");
    return argumentsText ? { action, showValues: true } : { action };
  }
  if (action === "pull") {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(argumentsText)) throw new Error("Use: shroud pull <KEY>");
    return { action, key: argumentsText };
  }
  if (action === "push") {
    const assignment = /^([A-Za-z_][A-Za-z0-9_]*)(?:=|\s+)([\s\S]*)$/.exec(argumentsText);
    if (!assignment) throw new Error('Use: shroud push <KEY> "<VALUE>" or shroud push <KEY>=<VALUE>');
    const value = literalArgument(assignment[2]);
    if (value.includes("\0")) throw new Error("NUL bytes are not supported.");
    return { action, key: assignment[1], value };
  }
  throw new Error("Unknown command. Type help to see browser commands.");
}

export function assertBrowserContext(action: string, project: string, environment: string) {
  if (["help", "clear", "whoami", "teams", "projects", "use"].includes(action)) return;
  if (!project) throw new Error("Enter a project first: shroud use <project>. Run shroud projects to find one.");
  if (["environments", "env"].includes(action)) return;
  if (!environment) throw new Error("Enter an environment first: shroud env development.");
}

export function browserCommandDisplay(command: BrowserCommand, original: string) {
  return command.action === "push" ? "shroud push " + command.key + " [value hidden]" : original.trim();
}

export function parseBrowserEnv(content: string): { key: string; value: string }[] {
  const values = new Map<string, string>();
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) throw new Error(`Invalid environment variable on line ${index + 1}`);
    const [, key, initial] = match;
    let value = initial;
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      let end = -1;
      let offset = 1;
      for (;;) {
        for (; offset < value.length; offset++) {
          if (value[offset] === quote) { end = offset; break; }
          if (quote === '"' && value[offset] === "\\") offset++;
        }
        if (end >= 0) break;
        if (++index >= lines.length) throw new Error(`Unclosed quoted value for ${key}`);
        value += "\n" + lines[index];
      }
      if (!/^\s*(?:#.*)?$/.test(value.slice(end + 1))) throw new Error(`Unexpected text after ${key}`);
      value = value.slice(1, end);
      if (quote === '"') value = value.replace(/\\([nrt"\\])/g, (_, escaped: string) => ({ n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" })[escaped] ?? escaped);
    } else value = value.replace(/\s+#.*$/, "").trimEnd();
    if (value.includes("\0")) throw new Error(`NUL bytes are not supported for ${key}`);
    values.set(key, value);
  }
  return [...values].map(([key, value]) => ({ key, value }));
}

export function serializeBrowserEnv(values: { key: string; value: string }[]): string {
  return values.map(({ key, value }) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error("Invalid environment variable name");
    if (value.includes("\0")) throw new Error(`NUL bytes are not supported for ${key}`);
    return `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
  }).join("\n") + "\n";
}
