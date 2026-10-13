# Shroud

Shroud is a workspace secrets manager for teams. Organize configuration by project and environment, manage encrypted secrets, and use the built-in browser terminal without installing anything.

The website is the main interface. An optional desktop CLI supports local `.env` files and running programs with secrets injected into their environment.

## Features

- Google and email/password authentication, with password recovery.
- Multiple workspaces, workspace switching, invitation links, and role-based membership.
- Projects with Development, Staging, and Production environments.
- Secret creation, editing, deletion, version history, and server-side encryption.
- Required keys and environment consistency checks.
- A browser terminal for reading and updating individual variables.
- API tokens with read/write scopes, expiration, and revocation.
- Workspace audit logs and in-app documentation.

## Tech stack

| Area | Technology |
| --- | --- |
| Website | Next.js App Router, React, TypeScript |
| UI | Tailwind CSS, Base UI, shadcn components, Lucide icons |
| Authentication and database | Supabase Auth and PostgreSQL with row-level security |
| Secret encryption | AES-256-GCM on the application server |
| Optional desktop CLI | TypeScript, Commander, Inquirer |

## Repository layout

```text
Shroud/
├── web/                  Next.js website, authenticated API, and public docs
│   ├── app/              Routes, dashboard pages, and API handlers
│   ├── components/       UI and browser terminal components
│   ├── lib/              Auth, workspace context, encryption, and helpers
│   └── .env.example      Website configuration template
├── cli/                  Optional desktop CLI and command tests
├── supabase/migrations/  SQL changes for the existing Shroud database
├── tests/                SQL security tests and local schema fixtures
└── scripts/              Development helpers
```

## Local setup

### 1. Prerequisites

- Node.js **22.12 or newer** and npm.
- A Supabase project containing the existing Shroud base schema.
- Access to that project's SQL Editor and Authentication settings.

The migrations in this repository extend an existing database. They do **not** create the entire base schema in an empty Supabase project. The schema under `tests/fixtures` is a test fixture, not a production installation script.

### 2. Apply database migrations

Open your Supabase project's **SQL Editor** and run unapplied migration files in this order:

| Migration | Purpose |
| --- | --- |
| [202610120001_complete_core.sql](supabase/migrations/202610120001_complete_core.sql) | Core RPCs, authorization, RLS, project operations, and audit support |
| [202610120002_app_table_grants.sql](supabase/migrations/202610120002_app_table_grants.sql) | Database table privileges required by the application |
| [202610120003_browser_terminal.sql](supabase/migrations/202610120003_browser_terminal.sql) | Authenticated secret reads and writes for the browser terminal |
| [202610130004_workspace_creation.sql](supabase/migrations/202610130004_workspace_creation.sql) | Empty workspace creation and owner-membership repair for legacy starter projects |

Apply each migration once. If earlier migrations have already been applied, run only the remaining files. The first migration moves existing functions into a private schema, so it should not be rerun as a setup shortcut.

After the final migration, new workspaces start empty. Existing starter projects and their data remain available.

### 3. Configure the website

From the repository root, copy the example environment file:

```powershell
Copy-Item web/.env.example web/.env.local
```

On macOS/Linux, use `cp web/.env.example web/.env.local`.

Fill in `web/.env.local`:

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Your Supabase publishable key or legacy anon key |
| `SHROUD_ENCRYPTION_KEY` | Yes | Base64 encoding of exactly 32 random bytes |
| `RESEND_API_KEY` | No | Optional email helper configuration; not needed for core setup |

For a new installation, generate the encryption key with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the encryption key private and stable. Existing installations must retain their current key: replacing it makes previously encrypted values unreadable. Never give this variable a `NEXT_PUBLIC_` prefix.

### 4. Configure authentication

In Supabase Authentication settings:

1. Set the development site URL to `http://localhost:3000`.
2. Allow development redirect URLs under `http://localhost:3000/**`. Shroud uses `/auth/callback` and `/auth/update-password`, including callback query parameters.
3. Enable the Email provider for email/password accounts.
4. Enable and configure the Google provider for Google sign-in.

Email confirmation follows your Supabase Auth settings. Configure custom SMTP in Supabase when you need your own sender and email delivery configuration. Supabase Auth emails do not use the optional Resend key above.

### 5. Start the app

From the repository root:

```bash
cd web
npm install
npm run dev
```

Open [Shroud locally](http://localhost:3000). Usage documentation is available at [localhost:3000/docs](http://localhost:3000/docs).

## Using the website

1. Sign up or sign in.
2. Create a workspace, or join an existing one using an invitation link or token.
3. Use the workspace menu in the dashboard header to switch between memberships.
4. Click **New project**. Each project gets Development, Staging, and Production environments.
5. Open a project, choose an environment, and add your secret keys and values.
6. Set required keys to check whether configuration is present across environments.
7. Use **Terminal** to read and update variables through commands.

Workspace membership and project membership are separate. A workspace can show a project with **Access required** until you have an appropriate project role. Project owners/admins manage project access; secret reads and writes follow your project role.

### Invitations

Workspace owners/admins can open **Team & invites** and select **Create invitation link**. Choose the role and expiry, then copy the generated invitation credentials.

Share the link with the intended recipient. They can open it or paste the full link or token into **Join workspace**. Joining another workspace keeps their existing memberships.

The join form currently accepts full invitation links or tokens; it does not accept the generated short invite code. Share invitation credentials yourself; creating an invitation does not automatically email it.

### API tokens

Workspace owners/admins can create tokens under **API tokens**. Choose the required scopes and expiry. The full token is shown once; save it when it is created.

- `secrets:read`: read values, pull files, and inject values into local programs.
- `secrets:write`: create or update secrets; desktop push also needs read access.

Tokens are for API/desktop automation. The browser terminal uses your signed-in session and does not require a token.

## Browser terminal: no installation required

Open **Dashboard → Terminal**. Listing projects does not select one: enter a project first, then choose an environment before accessing secrets.

```text
shroud projects
shroud use my-project
shroud environments
shroud env development
shroud push API_URL "https://api.example.com"
shroud pull API_URL
shroud secrets --values
```

Replace `my-project` with a project ID, slug, or quoted name from your project list.

| Command | What it does |
| --- | --- |
| `shroud projects` | List accessible projects in the selected workspace |
| `shroud use <project>` | Enter a project by ID, slug, or quoted name |
| `shroud cd <project>` | Alias for entering a project |
| `cd ..` | Leave the current project |
| `shroud environments` | List environments in the current project |
| `shroud env <environment>` | Select an environment by ID, slug, type, or name |
| `shroud secrets` | List keys in the current environment |
| `shroud secrets --values` | Reveal all current environment values |
| `shroud pull <KEY>` | Reveal one variable's value |
| `shroud push <KEY> "<VALUE>"` | Add or update one variable |
| `shroud push <KEY>=<VALUE>` | Alternative assignment syntax; `KEY=` saves an empty value |
| `shroud whoami` | Show the signed-in account |
| `shroud teams` | List your workspace memberships |
| `help` or `shroud --help` | Show the command reference |
| `clear` | Clear terminal history and visible output |

Browser pull/push operates on individual variables typed directly into the terminal. No desktop file upload or installation is required.

Values are literal: commands do not execute a system shell or expand variables. Quote values containing spaces. Push values are redacted from output and excluded from command recall. Values revealed by pull remain visible until you hide/clear them, switch context, or leave the page.

## Optional desktop CLI

Use the desktop CLI when you want to work with local `.env` files or launch local programs with injected secrets. Its pull/push syntax differs from the browser terminal.

From the repository root:

```bash
npm install -g ./cli
shroud login
shroud whoami
shroud pull -p my-project -e development -f .env.local
shroud push -p my-project -e staging -f .env.staging
shroud run -p my-project -e development -- npm run dev
```

Create an API token in the website before logging in. `shroud login` prompts privately and stores the token in `~/.shroud/config.json`.

The CLI defaults to `http://localhost:3000`. For a hosted instance, set `SHROUD_API_URL` to its base URL. In CI, provide `SHROUD_TOKEN` and `SHROUD_API_URL` instead of using interactive login.

See the [desktop CLI reference](cli/README.md) for installation, file overwrite behavior, and CI examples.

## Development checks

Build the website from the repository root:

```bash
cd web
npm run build
```

Run CLI and browser-command tests from the repository root:

```bash
cd cli
npm install
npm test
```

Run SQL authorization and migration tests from the repository root:

```bash
npm install --prefix .tmp/sql-check --no-save @electric-sql/pglite
node tests/security-migration.mjs
```

The SQL tests run against a local PGlite fixture rather than your Supabase database.

## Deployment

Deploy `web/` as a Next.js application and configure the same required environment variables on the server. For a self-hosted production server, run `npm run build` followed by `npm start` from `web/`.

Apply outstanding database migrations before using the deployment. Update Supabase's site URL and redirect allowlist for your production domain, and configure the Google provider for that deployment. Keep the same encryption key when moving an existing installation.

The desktop CLI can point to the deployment through `SHROUD_API_URL`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Google sign-in returns an error | Google provider configuration, redirect allowlist, and the callback's displayed error |
| Authentication reports `fetch failed` | The server's network access to Supabase and the configured project URL |
| Email confirmation or password reset does not arrive | Supabase email settings, SMTP configuration, and spam folder |
| Project reports **Access required** | Your project membership and role, even if you belong to its workspace |
| Environment checks or terminal queries fail | All four migrations are applied in order and the server can reach Supabase |
| Existing values cannot be decrypted | The original `SHROUD_ENCRYPTION_KEY` is still configured |
| Projects appear to be missing | The selected workspace in the dashboard header |

## Security and current scope

Secret values are encrypted on the application server before database storage. This is server-side encryption: the server holds the key and decrypts values for authorized requests. Access is enforced through authenticated API handlers, database functions, and RLS.

Keep server configuration and API tokens private. Do not commit `.env.local` or files pulled by the desktop CLI.

The browser terminal manages Shroud data; launching local programs is available through the optional desktop CLI. Stripe billing and scheduled missing-key email delivery are not implemented in the current application.
