# Shroud web app

This directory contains the Next.js website, dashboard, browser terminal, authenticated API, and public usage documentation.

Follow the [project README](../README.md) for database prerequisites, all four migrations, environment variables, and Supabase Auth configuration.

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
