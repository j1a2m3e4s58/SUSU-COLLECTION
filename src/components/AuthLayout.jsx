import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export function LogoBadge() {
  return (
    <div className="flex flex-col items-center">
      <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-background shadow-glass ring-4 ring-primary/20">
        <img
          src="/assets/images/bcb-logo.png"
          alt="Bawjiase Community Bank logo"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

export default function AuthLayout({ children, className }) {
  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img
          src="/assets/images/auth-bg.jpg"
          alt=""
          className="h-full w-full scale-105 object-cover blur-[5px]"
        />
        <div className="absolute inset-0 bg-background/45 dark:bg-background/65" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background/10 to-secondary/15" />
      </div>

      <div className="relative flex h-full items-center justify-center overflow-hidden px-4 pb-8 pt-16 sm:px-6 sm:pb-10 sm:pt-20">
        <div
          className={cn(
            "relative w-full max-w-md overflow-visible rounded-3xl border border-primary/20 bg-background/80 px-6 pb-8 pt-24 shadow-glass-dark backdrop-blur-xl dark:border-primary/25 dark:bg-card/85",
            className
          )}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
            <LogoBadge />
          </div>
          {children}
        </div>
      </div>

      <Toaster />
    </div>
  );
}
