# Shroud web app

This directory contains the Next.js website, dashboard, browser terminal, authenticated API, and public usage documentation.

Follow the [project README](../README.md) for the single database installer, environment variables, and Supabase Auth configuration.

From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Documentation is at [/docs](http://localhost:3000/docs), and the built-in terminal is under **Dashboard → Terminal**.

Copy [.env.example](.env.example) to `.env.local` and supply the Supabase URL, publishable key, and stable encryption key before using secrets.

For production:

```bash
npm run build
npm start
```

The optional desktop CLI is documented in [cli/README.md](../cli/README.md).

## Deploy on Vercel

Import the GitHub repository in Vercel and choose `web` as the Root Directory, Next.js as the framework, and Node.js 22.x. The checked-in `vercel.json` uses the verified Webpack production build.

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the existing `SHROUD_ENCRYPTION_KEY` in Vercel's environment variables. Keep the encryption key unchanged so existing secrets remain readable. Do not commit `.env.local`.

Vercel hosts both the website and its Next.js API routes. Supabase provides the database and authentication; no separate Render backend is required. The Vercel integration in Project Settings syncs managed secrets to other Vercel projects and is separate from hosting Shroud itself.

After deployment, set Supabase Auth's Site URL to your Vercel URL and allow its `/auth/callback` and `/auth/update-password` redirect URLs, including any callback query parameters your flows use. Test sign-in, reveal, and browser terminal pull/push on the deployed site.
