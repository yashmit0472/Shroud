import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Link href="/auth/login">
        <Button size="sm" variant="outline">
          Sign in
        </Button>
      </Link>

      <Link href="/auth/sign-up">
        <Button size="sm" variant="default">
          Sign up
        </Button>
      </Link>
    </div>
  );
}
