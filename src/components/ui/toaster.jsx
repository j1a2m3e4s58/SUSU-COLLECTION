import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

const toastMeta = {
  default: {
    icon: Info,
    iconClassName: "bg-primary/10 text-primary",
  },
  success: {
    icon: CheckCircle2,
    iconClassName: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  destructive: {
    icon: XCircle,
    iconClassName: "bg-red-500/15 text-red-600 dark:text-red-300",
  },
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant = "default", ...props }) {
        const meta = toastMeta[variant] || toastMeta.default;
        const Icon = meta.icon;
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconClassName}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
