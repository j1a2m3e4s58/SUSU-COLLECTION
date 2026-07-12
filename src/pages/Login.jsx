import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login, portalSettings } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout className="flex min-h-[520px] max-w-[420px] flex-col justify-center px-4 pb-6 pt-20 sm:px-5">
      <div className="mb-6 space-y-1.5 text-center">
        <div className="page-kicker text-center">Secure staff access</div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {portalSettings?.portalName || "SUSU Workspace"}
        </h1>
        <p className="mx-auto max-w-[17rem] text-xs leading-5 text-muted-foreground">
          {portalSettings?.loginSubtitle || "Sign in with your official email account"}
        </p>
      </div>

      {error && (
        <div className="mb-3 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label
            htmlFor="email"
            className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Official Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@bawjiasecommunitybank.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 glass-input text-sm"
            autoComplete="email"
            autoFocus
            required
          />
        </div>

        <div className="space-y-1">
          <Label
            htmlFor="password"
            className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 glass-input pr-10 text-sm"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-smooth hover:text-foreground"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(value) => setRememberMe(value === true)}
            />
            <Label htmlFor="remember" className="cursor-pointer text-muted-foreground">
              Remember me
            </Label>
          </div>
          <Link
            to="/forgot-password"
            className="shrink-0 text-muted-foreground transition-smooth hover:text-primary"
          >
            Forgot?
          </Link>
        </div>

        <Button
          type="submit"
          className="h-10 w-full glass-button text-sm font-bold uppercase tracking-[0.16em]"
          disabled={loading || !email || !password}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            portalSettings?.loginButtonText || "Sign In"
          )}
        </Button>
      </form>

      <div className="mt-3 border-t border-border/40 pt-3 text-center">
        <p className="text-sm text-muted-foreground">
          New Staff?{" "}
          <Link to="/register" className="font-medium text-primary transition-smooth hover:text-primary/80">
            Sign Up
          </Link>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {portalSettings?.authorizedAccessText || "Authorized access only"}
        </p>
      </div>
    </AuthLayout>
  );
}
