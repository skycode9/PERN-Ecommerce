import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { google, login } from "@/features/auth/api";
import { useAuthStore } from "@/features/auth/store";
import type { AuthResponse } from "@/features/auth/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/lib/env";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LocationState = { from?: string } | null;

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((state) => state.setUser);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const from = (location.state as LocationState)?.from;

  function completeAuth({ accessToken, user }: AuthResponse) {
    setAccessToken(accessToken);
    setUser(user);
    navigate(from || (user.role === "admin" ? "/admin" : "/"), { replace: true });
  }

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!emailPattern.test(email.trim())) next.email = "Enter a valid email";
    if (!password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !validate()) return;

    setSubmitting(true);
    try {
      const result = await login({ email: email.trim(), password });
      completeAuth(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle(credential?: string) {
    if (!credential) {
      toast.error("Google sign-in failed");
      return;
    }

    setGoogleLoading(true);
    try {
      const result = await google(credential);
      completeAuth(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setGoogleLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setErrors({});
  }

  const busy = submitting || googleLoading;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Welcome back</CardTitle>
          <CardDescription>Sign in to continue to your account</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {env.demoMode && (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs text-muted-foreground">
                Just looking around? Sign in with a demo account.
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => fillDemo(account.email)}
                  >
                    {account.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={!!errors.email}
                disabled={busy}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={!!errors.password}
                disabled={busy}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {submitting && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(response) => handleGoogle(response.credential)}
              onError={() => toast.error("Google sign-in failed")}
              width="320"
            />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              to="/sign-up"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
