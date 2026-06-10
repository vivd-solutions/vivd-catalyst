import { type FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { signInWithEmail } from "./auth-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

export function LoginPanel({
  apiBaseUrl,
  onSignedIn
}: {
  apiBaseUrl: string;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const result = await signInWithEmail({
      apiBaseUrl,
      email,
      password
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Sign in failed");
      return;
    }
    onSignedIn();
  }

  return (
    <main
      className="grid h-dvh w-full place-items-center overflow-hidden bg-sidebar p-5 text-foreground"
      aria-label="Sign in"
    >
      <Card className="w-full max-w-[380px]">
        <CardHeader className="gap-4">
          <div className="grid size-11 place-items-center rounded-lg border bg-card text-primary">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Email</span>
              <Input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Password</span>
              <Input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending || !email || !password}>
              {pending ? "Signing in" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
