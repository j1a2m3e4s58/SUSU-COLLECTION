import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UserNotRegisteredError() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Account not registered</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account exists, but it has not been registered for this workspace.
        </p>
        <Button className="mt-6 w-full" onClick={() => (window.location.href = "/login")}>
          Back to login
        </Button>
      </section>
    </main>
  );
}
