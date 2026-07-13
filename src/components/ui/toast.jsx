import * as React from "react";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    data-portal-toast-root=""
    className="fixed inset-x-3 bottom-20 z-[100] flex max-h-screen flex-col-reverse gap-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:flex-col md:w-full md:max-w-[420px]"
    {...props}
  />
));
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    data-portal-toast-root=""
    className="fixed inset-x-3 bottom-20 z-[100] flex max-h-screen flex-col-reverse gap-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:flex-col md:w-full md:max-w-[420px]"
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  "portal-toast group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-2xl border p-4 pr-10 shadow-2xl backdrop-blur-xl transition-smooth animate-in fade-in-0 slide-in-from-bottom-4 sm:slide-in-from-right-5",
  {
    variants: {
      variant: {
        default:
          "border-primary/25 bg-card/95 text-foreground shadow-[0_22px_60px_rgba(37,99,235,0.18)] dark:bg-card/95",
        success:
          "border-emerald-500/30 bg-emerald-50/95 text-emerald-950 shadow-[0_22px_60px_rgba(16,185,129,0.20)] dark:bg-emerald-950/90 dark:text-emerald-50",
        warning:
          "border-amber-500/35 bg-amber-50/95 text-amber-950 shadow-[0_22px_60px_rgba(245,158,11,0.22)] dark:bg-amber-950/90 dark:text-amber-50",
        destructive:
          "destructive group border-red-500/35 bg-red-50/95 text-red-950 shadow-[0_22px_60px_rgba(239,68,68,0.22)] dark:bg-red-950/90 dark:text-red-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef(({ className, variant, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-full p-1 text-current/45 transition-colors hover:bg-current/10 hover:text-current focus:outline-none focus:ring-2 focus:ring-current/25",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-bold leading-5", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm leading-5 opacity-80", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
