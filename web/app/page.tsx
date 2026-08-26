import {
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  GitBranch,
  KeyRound,
  Lock,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";

const features = [
  {
    icon: KeyRound,
    title: "One source of truth",
    description:
      "Keep environment secrets organized across every project and deployment.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description:
      "Create teams, manage access, and share projects without passing secrets around.",
  },
  {
    icon: GitBranch,
    title: "Version everything",
    description:
      "Track secret changes and restore previous versions when something goes wrong.",
  },
  {
    icon: ShieldCheck,
    title: "Security by default",
    description:
      "Encrypted secret storage, scoped access, audit logs, and secure authentication.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted">
            <Lock className="h-4 w-4" />
          </div>

          <span className="text-lg font-semibold tracking-tight">
            Shroud
          </span>
        </div>

        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#security" className="transition-colors hover:text-foreground">
            Security
          </a>
          <a href="#developers" className="transition-colors hover:text-foreground">
            Developers
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Sign in
          </a>

          <a
            href="/login"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Get started
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-20 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-foreground/[0.035] blur-3xl" />
        </div>

        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-24 text-center lg:pt-32">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            Secure secrets for modern teams
          </div>

          <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            Your secrets.
            <br />
            <span className="text-muted-foreground">Under control.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Shroud gives teams a secure place to manage environment secrets,
            control access, track changes, and ship without passing sensitive
            values around.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="/login"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background transition-all hover:gap-3"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>

            <a
              href="#developers"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              Explore Shroud
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-20 w-full max-w-4xl text-left">
            <div className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />

                <div className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" />
                  shroud
                </div>
              </div>

              <div className="space-y-3 p-6 font-mono text-sm">
                <div>
                  <span className="text-muted-foreground">$</span>{" "}
                  <span>shroud pull --env production</span>
                </div>

                <div className="space-y-2 pl-4 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-foreground" />
                    DATABASE_URL
                  </div>

                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-foreground" />
                    REDIS_URL
                  </div>

                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-foreground" />
                    JWT_SECRET
                  </div>

                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-foreground" />
                    STRIPE_SECRET_KEY
                  </div>
                </div>

                <div className="pt-2 text-muted-foreground">
                  ✓ Environment synchronized
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-muted-foreground">
              Everything your team needs
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Secrets shouldn't be a deployment problem.
            </h2>

            <p className="mt-4 text-muted-foreground">
              Shroud brings your secrets, environments, access controls, and
              developer workflow into one place.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="bg-background p-8 transition-colors hover:bg-muted/30"
                >
                  <Icon className="h-5 w-5" />

                  <h3 className="mt-6 font-medium">{feature.title}</h3>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Developer section */}
      <section id="developers" className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-2 lg:px-8">
          <div className="flex flex-col justify-center">
            <Code2 className="h-6 w-6" />

            <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
              Designed for developers.
            </h2>

            <p className="mt-5 max-w-lg leading-7 text-muted-foreground">
              Manage secrets from the dashboard when you want visibility, or
              use the Shroud CLI and API when you want speed.
            </p>

            <div className="mt-8 space-y-3 text-sm text-muted-foreground">
              {[
                "REST API for automation",
                "CLI for local development and deployments",
                "Environment-aware secret management",
                "Version history and audit trails",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-foreground" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-6 font-mono text-sm">
            <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Terminal className="h-4 w-4" />
              terminal
            </div>

            <div className="space-y-4">
              <p>
                <span className="text-muted-foreground">$</span> shroud login
              </p>

              <p className="text-muted-foreground">
                ✓ Authenticated with Shroud
              </p>

              <p>
                <span className="text-muted-foreground">$</span> shroud pull
              </p>

              <p className="text-muted-foreground">
                ✓ Pulled 12 secrets from production
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="rounded-2xl border border-border bg-muted/20 p-8 sm:p-12 lg:p-16">
            <div className="max-w-2xl">
              <ShieldCheck className="h-6 w-6" />

              <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                Security isn't a feature we add later.
              </h2>

              <p className="mt-5 leading-7 text-muted-foreground">
                Shroud is being designed around encryption, least-privilege
                access, auditability, and secure developer workflows from the
                beginning.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  "Encrypted secret storage",
                  "Role-based access",
                  "Audit logging",
                  "Secure API tokens",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm"
                  >
                    <Lock className="h-4 w-4" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-28 text-center">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Ready to put your secrets
            <br />
            under control?
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Create your Shroud workspace and start building a safer developer
            workflow.
          </p>

          <a
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span>Shroud</span>
          </div>

          <p>Secure secrets. Simple workflow.</p>
        </div>
      </footer>
    </main>
  );
}