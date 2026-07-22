import React from "react";
import { AlertTriangle, LogIn, RefreshCw } from "lucide-react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Portal render failure", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-heading text-xl font-bold">The portal could not display this page</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your saved records have not been changed. Reload the page, or return to sign in if the problem continues.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/login"; }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold"
            >
              <LogIn className="h-4 w-4" />
              Return to Login
            </button>
          </div>
        </section>
      </main>
    );
  }
}
