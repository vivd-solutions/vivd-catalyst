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
  const [email, setEmail] = useState("user@example.test");
  const [password, setPassword] = useState("demo-user-password");
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
    <main className="acp-auth-shell" aria-label="Sign in">
      <Card className="acp-auth-card">
        <CardHeader>
          <div className="acp-auth-mark">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="acp-auth-form" onSubmit={onSubmit}>
            <label>
              <span>Email</span>
              <Input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Password</span>
              <Input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? <p className="acp-auth-error">{error}</p> : null}
            <Button type="submit" disabled={pending || !email || !password}>
              {pending ? "Signing in" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
