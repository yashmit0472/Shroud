# Shroud CLI

The Shroud CLI pulls and pushes encrypted environment variables through your Shroud web app. It also starts a process with the selected environment's variables without writing a file.

For commands inside the website, use **Dashboard → Terminal** with no installation or API token. This guide covers the optional desktop tool for local files and processes; see the [project README](../README.md#browser-terminal-no-installation-required) for browser commands.

## Install

Requirements: Node.js 22.12 or newer and a running Shroud web app.

From this repository:

```bash
npm install -g ./cli
```

Or download the package from the Shroud site's **Docs → Optional desktop CLI and CI instructions** section and install the tarball:

```bash
npm install -g ./shroud-cli-1.0.0.tgz
```

The package is not published to the npm registry yet. Set `SHROUD_API_URL` to your deployed Shroud web URL. It defaults to `http://localhost:3000`.

## Authenticate

Sign in on the web and open **API tokens**. Create a token with `secrets:read` for pull/run or both `secrets:read` and `secrets:write` for push. Copy it once, then run:

```bash
shroud login
shroud whoami
shroud teams
```

`shroud login` prompts for the token without echoing it. The CLI stores it in `~/.shroud/config.json`. In CI, set `SHROUD_TOKEN` instead of running login.

## Commands

| Command | What it does |
| --- | --- |
| `shroud login` | Prompt for a token, validate it, and save it locally |
| `shroud whoami` | Check the current token and show its team |
| `shroud teams` | List accessible teams |
| `shroud pull -p <project> -e <environment> -f <file>` | Write values to a .env file |
| `shroud push -p <project> -e <environment> -f <file>` | Create or update values from a .env file |
| `shroud run -p <project> -e <environment> -- <command>` | Run a command with values in its environment |

Project and environment may be IDs or slugs. Omit them in an interactive terminal to select from a prompt. Use explicit flags in CI.

```bash
shroud pull -p my-api -e development -f .env.local
shroud pull -p my-api -e production -f .env.production --force
shroud push -p my-api -e staging -f .env.staging
shroud run -p my-api -e development -- npm run dev
```

`pull` refuses to overwrite an existing file unless you confirm interactively or pass `--force`. `run` does not create a file and does not pass `SHROUD_TOKEN` to its child process. Do not commit pulled .env files; add them to `.gitignore`.

## CI example

```bash
export SHROUD_API_URL=https://your-shroud.example
export SHROUD_TOKEN=shroud_...
shroud run -p my-api -e production -- npm run build
```

Use a read-only token for pull and run. Give CI write access only if it pushes secrets. Revoke tokens in the Shroud dashboard when they are no longer needed.


