import Link from "next/link";
import { ArrowRight, Download, KeyRound, LockKeyhole, Terminal } from "lucide-react";
import { CommandBlock } from "@/components/command-block";

function DesktopCliGuide() {
  return <div className="docs-prose">
    <div className="grid gap-4 md:grid-cols-3">
      <div className="surface-card p-5"><Download className="h-5 w-5 text-lime-300" /><h3 className="mt-3 !text-base">1. Install</h3><p className="!mt-1 text-sm">Download the package and install it with npm.</p></div>
      <div className="surface-card p-5"><KeyRound className="h-5 w-5 text-lime-300" /><h3 className="mt-3 !text-base">2. Authenticate</h3><p className="!mt-1 text-sm">Create a scoped API token in your workspace.</p></div>
      <div className="surface-card p-5"><Terminal className="h-5 w-5 text-lime-300" /><h3 className="mt-3 !text-base">3. Sync & run</h3><p className="!mt-1 text-sm">Pull a .env file, push updates, or inject variables into a process.</p></div>
    </div>
    <h2 id="cli-install">Install the CLI</h2>
    <p>Requires Node.js 22.12 or newer. The CLI is packaged with this app; it is not yet published to the npm registry.</p>
    <a className="btn-accent mt-5" href="/downloads/shroud-cli-1.0.0.tgz" download><Download className="h-4 w-4" /> Download CLI package</a>
    <CommandBlock label="install from downloaded file" code={"npm install -g ./shroud-cli-1.0.0.tgz\nshroud --help"} />
    <p>If you have this repository locally, you can instead run <code>npm install -g ./cli</code> from its root. On a hosted Shroud deployment, set <code>SHROUD_API_URL</code> to your Shroud web URL. The CLI defaults to <code>http://localhost:3000</code>.</p>
    <h2 id="cli-token">Create an API token</h2>
    <p>In the dashboard, open <Link className="text-lime-300 hover:underline" href="/dashboard/tokens">API tokens</Link>. Choose read access for pulling or running secrets. Add write access only if you will push values. Copy the new token when it appears; Shroud only shows it once.</p>
    <CommandBlock label="authenticate" code={"shroud login\nshroud whoami\nshroud teams"} />
    <p><code>shroud login</code> prompts for the token privately and stores it in <code>~/.shroud/config.json</code>. For CI, set <code>SHROUD_TOKEN</code> instead of saving a local login.</p>
    <h2 id="cli-commands">Commands</h2>
    <div className="mt-4 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-white/5 text-foreground"><tr><th className="px-4 py-3">Command</th><th className="px-4 py-3">Purpose</th></tr></thead><tbody className="divide-y divide-white/10 text-muted-foreground"><tr><td className="px-4 py-3 font-mono text-lime-300">login</td><td className="px-4 py-3">Validate and save a token</td></tr><tr><td className="px-4 py-3 font-mono text-lime-300">whoami</td><td className="px-4 py-3">Check current authentication</td></tr><tr><td className="px-4 py-3 font-mono text-lime-300">teams</td><td className="px-4 py-3">List accessible teams</td></tr><tr><td className="px-4 py-3 font-mono text-lime-300">pull</td><td className="px-4 py-3">Write environment values to a local .env file</td></tr><tr><td className="px-4 py-3 font-mono text-lime-300">push</td><td className="px-4 py-3">Create or update secrets from a .env file</td></tr><tr><td className="px-4 py-3 font-mono text-lime-300">run</td><td className="px-4 py-3">Run a command with Shroud values injected into its environment</td></tr></tbody></table></div>
    <h2 id="cli-examples">Common workflows</h2>
    <p>Use a project ID or slug after <code>-p</code>, and an environment ID, slug, or type after <code>-e</code>. In an interactive terminal you can omit them and choose from a prompt.</p>
    <CommandBlock label="local development" code={"shroud pull -p my-api -e development -f .env.local\nshroud run -p my-api -e development -- npm run dev"} />
    <CommandBlock label="update staging" code={"shroud push -p my-api -e staging -f .env.staging\nshroud pull -p my-api -e staging -f .env.staging --force"} />
    <p><code>pull</code> asks before overwriting an existing file; <code>--force</code> skips that prompt. <code>run</code> does not write a file. Add any pulled .env file to your project&apos;s <code>.gitignore</code>.</p>
    <div className="surface-card mt-8 flex items-start gap-4 p-5"><LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-lime-300" /><div><h3 className="!mt-0 !text-base">CI and deployment</h3><p className="!mt-1 text-sm">Set <code>SHROUD_TOKEN</code> and <code>SHROUD_API_URL</code> as protected environment variables in your CI system. Use a read-only token for <code>pull</code> and <code>run</code>. Revoke it from the dashboard when no longer needed.</p></div></div>
    <CommandBlock label="CI example" code={"SHROUD_API_URL=https://your-shroud.example SHROUD_TOKEN=shroud_... shroud run -p my-api -e production -- npm run build"} />
    <Link href="/dashboard/tokens" className="mt-7 inline-flex items-center gap-2 font-semibold text-lime-300 hover:underline">Manage API tokens <ArrowRight className="h-4 w-4" /></Link>
  </div>;
}

export function CliGuide() {
  return <div className="docs-prose">
    <h2>Use the browser terminal</h2>
    <p>Open <Link className="text-lime-300 hover:underline" href="/dashboard/cli">Dashboard → Terminal</Link>. Your website session supplies authentication. No installation or API token is required.</p>
    <ol><li>Run <code>shroud projects</code>, then <code>shroud use &lt;project&gt;</code> to enter one. A new terminal starts without an active project.</li><li>Run <code>shroud environments</code>, then <code>shroud env development</code>. You can also enter a project and environment with the selectors.</li><li>Run <code>shroud push KEY &quot;value&quot;</code> to add or update one variable. Run <code>shroud pull KEY</code> to display its value.</li></ol>
    <CommandBlock label="browser terminal" code={'shroud projects\nshroud use my-api\nshroud environments\nshroud env development\nshroud push API_KEY "your-value"\nshroud pull API_KEY\nshroud secrets --values'} />
    <div className="mt-5 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[550px] text-left text-sm"><thead className="bg-white/5"><tr><th className="px-4 py-3">Command</th><th className="px-4 py-3">In the website</th></tr></thead><tbody className="divide-y divide-white/10 text-muted-foreground">{[
      ["help / shroud --help", "Show available commands"],
      ["shroud whoami / shroud teams", "Show your account or teams"],
      ["shroud projects", "List accessible projects without entering one"],
      ["shroud use <project>", "Enter a project by ID, slug, or quoted name"],
      ["shroud cd <project> / cd ..", "Enter a project or leave the current one"],
      ["shroud environments", "List environments in your current project"],
      ["shroud env <environment>", "Enter an environment by ID, slug, or name"],
      ["shroud secrets", "List variable names"],
      ["shroud secrets --values", "Reveal all variables and their values"],
      ["shroud pull <KEY>", "Reveal the value of one variable"],
      ['shroud push <KEY> "<VALUE>"', "Add or update one variable directly"],
      ["shroud push <KEY>=<VALUE>", "Alternate syntax; KEY= saves an empty value"],
      ["clear", "Clear output and command history"],
    ].map(([command, description]) => <tr key={command}><td className="px-4 py-3 font-mono text-lime-300">{command}</td><td className="px-4 py-3">{description}</td></tr>)}</tbody></table></div>
    <p>The prompt shows your current project and environment. Listing projects does not enter one. Secret commands require both selections, and no project is selected automatically. Switching projects resets the environment.</p>
    <h3>Working with values</h3>
    <p>Push saves the variable name and value you type, with no file picker. Put values containing spaces in quotes. Values are literal: Shroud does not expand variables or execute shell syntax. Existing variables receive a new version; descriptions, required flags, and other variables stay unchanged.</p>
    <p>Pull displays one variable as <code>KEY=&quot;value&quot;</code>. Use <code>shroud secrets --values</code> to see every value in the active environment. Push values are hidden in command output and excluded from Arrow Up/Down recall. Revealed values are kept only in the current page and disappear on context changes, <strong>Hide values</strong>, or <code>clear</code>.</p>
    <p>Project viewers can read values. Developers, admins, and owners can add and update variables.</p>
    <h3>Production writes</h3><p>Production writes open a confirmation dialog. If the project requires independent approval, the terminal reports a pending request instead of saving immediately. A different project owner/admin approves it in Activity. The optional desktop CLI uses <code>--confirm-production</code> on push.</p>
    <h3>Running local apps</h3><p>The browser terminal manages Shroud variables. It cannot start programs on your computer or inject values into a local process. The optional desktop CLI supports .env file sync, <code>shroud run</code>, and CI workflows.</p>
    <details className="surface-card mt-8 p-5"><summary className="cursor-pointer text-sm font-semibold text-lime-300">Optional desktop CLI and CI instructions</summary><div className="mt-6"><DesktopCliGuide /></div></details>
  </div>;
}
