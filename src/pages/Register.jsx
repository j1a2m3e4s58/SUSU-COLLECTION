import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ControlledSelect from "@/components/ui/controlled-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import { registerWithEmail, resendVerification, verifyEmail } from "@/api/authClient";
import { getPortalSettings } from "@/api/portalClient";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  XCircle,
} from "lucide-react";

const defaultBranches = ["HEAD OFFICE", "BAWJIASE", "ADEISO", "OFAAKOR", "KASOA NEW MARKET", "KASOA MAIN"];
const defaultDepartments = ["SUSU", "SUSU AGENT"];

export default function Register() {
  const [branches, setBranches] = useState(defaultBranches);
  const [departments, setDepartments] = useState(defaultDepartments);
  const [step, setStep] = useState("form");
  const [form, setForm] = useState({
    fullname: "",
    phone: "",
    email: "",
    department: "",
    branch: "",
    position: "Staff",
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    getPortalSettings()
      .then((settings) => {
        if (!mounted) return;
        setBranches(settings.branches?.length ? settings.branches : defaultBranches);
        setDepartments(defaultDepartments);
      })
      .catch(() => {
        if (!mounted) return;
        setBranches(defaultBranches);
        setDepartments(defaultDepartments);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordsMismatch = password && confirmPassword && password !== confirmPassword;
  const passwordRules = [
    { label: "8+ Characters", valid: password.length >= 8 },
    { label: "Uppercase (A-Z)", valid: /[A-Z]/.test(password) },
    { label: "Small Letters (a-z)", valid: /[a-z]/.test(password) },
    { label: "Number/Symbol @1", valid: /[\d\W_]/.test(password) },
  ];

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submitRegistration = async (code) => {
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail({
        ...form,
        accessCode: "",
        password,
      });
      setStep("verify");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    await submitRegistration();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyEmail(form.email, verifyCode);
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    try {
      await resendVerification(form.email);
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    }
  };

  if (step === "verify") {
    return (
      <AuthLayout>
        <div className="mb-6 space-y-1 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Verify Your Email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <strong>{form.email}</strong>
          </p>
        </div>

        {error && (
          <div className="mb-3 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              className="h-14 glass-input text-center font-mono text-xl tracking-widest"
              required
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full glass-button font-semibold"
            disabled={loading || verifyCode.length < 6}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Sign In"
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Didn't get the code?{" "}
            <button type="button" className="text-primary hover:underline" onClick={handleResendCode}>
              Resend
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout className="flex max-w-[450px] flex-col justify-center px-4 pb-4 pt-14 sm:px-5">
      <div className="mb-1.5 space-y-0.5 text-center">
        <h1 className="font-display text-xl font-bold text-foreground">
          Staff Registration
        </h1>
        <p className="text-xs text-muted-foreground">Create your secure account</p>
      </div>

      {error && (
        <div className="mb-2 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-1.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="fullname" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Full Name
            </Label>
            <Input
              id="fullname"
              placeholder="John Mensah"
              value={form.fullname}
              onChange={(e) => update("fullname", e.target.value)}
              className="h-8 rounded-lg glass-input text-sm"
              required
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="phone" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="024 XXX XXXX"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="h-8 rounded-lg glass-input text-sm"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="reg-email" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Official Email
          </Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="you@bawjiasecommunitybank.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="h-8 rounded-lg glass-input text-sm"
            autoComplete="email"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1">
            <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Branch
            </Label>
            <ControlledSelect
              value={form.branch}
              onChange={(value) => update("branch", value)}
              options={branches}
              placeholder="Select..."
              className="h-8 rounded-lg border-primary/15 bg-background/70 text-sm shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-card/70"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              SUSU Category
            </Label>
            <ControlledSelect
              value={form.department}
              onChange={(value) => update("department", value)}
              options={departments}
              placeholder="Select..."
              className="h-8 rounded-lg border-primary/15 bg-background/70 text-sm shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-card/70"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="reg-password" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 rounded-lg glass-input pr-10 text-sm"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-smooth hover:text-foreground"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="confirm-password" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Confirm
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat Pass"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-8 rounded-lg glass-input pr-10 text-sm"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-smooth hover:text-foreground"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={
            passwordsMatch
              ? "h-4 rounded-md bg-secondary/40 px-3 py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-secondary-foreground"
              : passwordsMismatch
                ? "h-4 rounded-md bg-destructive/15 px-3 py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-destructive"
                : "h-4 px-3 py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-transparent"
          }
        >
          {passwordsMatch ? "Passwords Match" : passwordsMismatch ? "Passwords Do Not Match" : "Password Status"}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg border border-border/70 bg-muted/20 px-2 py-1 text-[9px] font-medium">
          {passwordRules.map((rule) => {
            const Icon = rule.valid ? CheckCircle2 : XCircle;
            return (
              <span
                key={rule.label}
                className={rule.valid ? "flex items-center gap-1 text-green-700" : "flex items-center gap-1 text-destructive"}
              >
                <Icon className="h-3 w-3 shrink-0" />
                {rule.label}
              </span>
            );
          })}
        </div>

        <Button
          type="submit"
          className="mt-1 h-9 w-full rounded-xl glass-button text-sm font-bold uppercase tracking-wide"
          disabled={
            loading ||
            !form.email ||
            !password ||
            !confirmPassword ||
            !form.department ||
            !form.branch ||
            !form.fullname ||
            !form.phone ||
            password !== confirmPassword
          }
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <div className="mt-2 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium transition-smooth hover:text-primary">
          Back to Login
        </Link>
      </div>
    </AuthLayout>
  );
}
