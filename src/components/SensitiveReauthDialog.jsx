import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { reauthenticate } from "@/api/authClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SensitiveReauthDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const show = () => {
      setPassword("");
      setError("");
      setOpen(true);
    };
    window.addEventListener("portal-reauth-required", show);
    return () => window.removeEventListener("portal-reauth-required", show);
  }, []);

  const confirm = async () => {
    if (!password) {
      setError("Enter your current password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await reauthenticate(password);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("portal-toast", { detail: {
        title: "Identity confirmed",
        description: "Repeat the sensitive action to continue.",
      }}));
    } catch (err) {
      setError(err.message || "Could not confirm your identity.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" /> Confirm your identity
          </DialogTitle>
          <DialogDescription>
            Enter your current password before changing or removing protected financial records.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="sensitive-password">Current password</Label>
          <Input
            id="sensitive-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") confirm(); }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={confirm} disabled={submitting}>
            {submitting ? "Confirming..." : "Confirm identity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
