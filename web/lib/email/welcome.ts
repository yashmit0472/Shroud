import resend from "./resend";

interface WelcomeEmailParams {
  email: string;
  name?: string | null;
}

export async function sendWelcomeEmail({
  email,
  name,
}: WelcomeEmailParams) {
  const displayName = name || "there";

  return resend.emails.send({
    from: "Shroud <onboarding@resend.dev>",
    to: email,
    subject: "Welcome to Shroud",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 28px; margin-bottom: 16px;">
          Welcome to Shroud, ${displayName}.
        </h1>

        <p style="font-size: 16px; line-height: 1.6; color: #555;">
          Your secure workspace for managing team secrets is ready.
        </p>

        <p style="font-size: 16px; line-height: 1.6; color: #555;">
          You can now create a team, join an existing workspace,
          and start managing your project's environments securely.
        </p>

        <div style="margin-top: 32px;">
          <a
            href="http://localhost:3000/onboarding"
            style="display: inline-block; padding: 12px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 8px;"
          >
            Open Shroud
          </a>
        </div>

        <p style="margin-top: 40px; font-size: 13px; color: #999;">
          You're receiving this because a Shroud account was created
          using this email address.
        </p>
      </div>
    `,
  });
}
