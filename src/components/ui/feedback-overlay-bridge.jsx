import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";

const MESSAGE_SELECTOR = [
  "[role='alert']",
  ".bg-destructive\\/10",
  ".bg-red-500\\/10",
  ".bg-emerald-500\\/10",
  ".bg-amber-500\\/10",
].join(",");

const ignoredText = new Set(["", "cancel", "save", "edit", "remove", "delete"]);

function cleanMessage(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function elementIsVisible(element) {
  if (!element || element.closest("[data-portal-toast-root]") || element.closest(".portal-toast")) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function detectVariant(element) {
  const classes = String(element.className || "");
  const text = cleanMessage(element.textContent).toLowerCase();
  if (classes.includes("emerald") || /\b(saved|success|updated|added|removed|restored|exported|imported|loaded|reopened|completed)\b/.test(text)) {
    return "success";
  }
  if (classes.includes("amber") || /\b(warning|backup|test mode|live mode|confirm|before)\b/.test(text)) {
    return "warning";
  }
  if (classes.includes("destructive") || classes.includes("red") || /\b(error|invalid|failed|could not|not found|required|denied|expired)\b/.test(text)) {
    return "destructive";
  }
  return "default";
}

function titleForVariant(variant) {
  if (variant === "success") return "Success";
  if (variant === "warning") return "Warning";
  if (variant === "destructive") return "Action needed";
  return "Notice";
}

export default function FeedbackOverlayBridge() {
  const seenRef = useRef(new Map());

  useEffect(() => {
    const showMessage = (element) => {
      if (!elementIsVisible(element)) return;
      const message = cleanMessage(element.textContent);
      if (message.length < 3 || message.length > 220 || ignoredText.has(message.toLowerCase())) return;
      const variant = detectVariant(element);
      const key = `${variant}:${message}`;
      const now = Date.now();
      const lastSeen = seenRef.current.get(key) || 0;
      if (now - lastSeen < 4500) return;
      seenRef.current.set(key, now);
      toast({
        variant,
        title: titleForVariant(variant),
        description: message,
        duration: variant === "destructive" ? 6200 : 4800,
      });
    };

    const scan = (root = document.body) => {
      if (!root?.querySelectorAll) return;
      root.querySelectorAll(MESSAGE_SELECTOR).forEach(showMessage);
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches?.(MESSAGE_SELECTOR)) showMessage(node);
            scan(node);
          });
        }
        if (mutation.type === "characterData" && mutation.target.parentElement?.matches?.(MESSAGE_SELECTOR)) {
          showMessage(mutation.target.parentElement);
        }
      });
    });

    scan();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
