import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

export function LogoBadge() {
  return (
    <div className="flex flex-col items-center">
      <div className="h-28 w-28 overflow-hidden rounded-full border-[10px] border-white bg-white shadow-2xl ring-2 ring-[#d9a529]/70 sm:h-36 sm:w-36 lg:h-52 lg:w-52">
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
    <div className="auth-page relative min-h-screen overflow-y-auto overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-95" aria-hidden="true">
        <img
          src="/assets/images/auth-bg.jpg"
          alt=""
          className="h-full w-full scale-105 object-cover blur-[3px]"
        />
        <div className="absolute inset-0 bg-[#e6f7ff]/70 dark:bg-background/70" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="auth-brand-panel relative min-h-[300px] overflow-hidden px-6 pb-16 pt-10 text-white sm:min-h-[380px] lg:min-h-screen lg:px-12 lg:py-14">
          <img
            src="/assets/images/auth-bg.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#002916]/95 via-[#00582f]/82 to-[#063f27]/70" />
          <div className="absolute -right-14 -top-28 h-[35rem] w-[35rem] rounded-full border-[1.5rem] border-white/90 shadow-[0_0_0_2px_rgba(217,165,41,0.85)] lg:-right-16 lg:h-[48rem] lg:w-[48rem]" />
          <div className="absolute right-[8%] top-[12%] h-64 w-64 rounded-full border border-[#d9a529]/80 opacity-90 sm:h-80 sm:w-80 lg:right-[16%] lg:top-[18%] lg:h-[28rem] lg:w-[28rem]" />
          <div className="absolute right-[15%] top-[18%] h-56 w-56 rounded-full border border-dashed border-[#d9a529]/70 sm:h-72 sm:w-72 lg:right-[23%] lg:top-[23%] lg:h-[22rem] lg:w-[22rem]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#00391f]/95 to-transparent" />

          <div className="relative z-10 flex min-h-[240px] flex-col items-center justify-center sm:min-h-[320px] lg:min-h-[calc(100vh-7rem)]">
            <LogoBadge />
          </div>

          <div className="relative z-10 mx-auto max-w-xl lg:mx-0">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d9a529] text-[#ffd86b] shadow-lg">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Building stronger communities, together.</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/85">
                  At Bawjiase Community Bank, we are committed to secure, transparent and community-focused financial solutions.
                </p>
                <p className="mt-3 inline-flex border-t-2 border-[#d9a529] pt-2 text-xs font-bold uppercase tracking-[0.28em] text-[#ffd86b]">
                  Leaders in innovation
                </p>
              </div>
            </div>
          </div>
        </section>

        <main className="auth-form-panel relative flex items-center justify-center px-4 py-8 sm:px-8 lg:min-h-screen lg:py-12">
          <div className="absolute inset-0 auth-form-backdrop" />
          <div
            className={cn(
              "auth-surface relative w-full max-w-[440px] rounded-[1.75rem] border border-white/80 px-6 pb-7 pt-16 text-[#10351f] shadow-[0_24px_70px_rgba(0,42,22,0.16)] backdrop-blur-xl sm:px-7",
              className
            )}
          >
            <div className="absolute left-1/2 top-0 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-2xl ring-1 ring-black/5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#0b7a3e]/30 text-[#006b35]">
                <ShieldCheck className="h-8 w-8" />
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
