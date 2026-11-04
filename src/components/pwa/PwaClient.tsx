"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { serviceWorkerUrl } from "@/lib/pwa/sw";

/**
 * Registers the service worker (production builds only; next dev would cache its own hot reloads) and offers a
 * new version quietly: "Yeni sürüm hazır · Yenile". Nothing reloads until the visitor presses it.
 */
export function PwaClient() {
  const { m } = useI18n();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    // A page loaded before any worker controlled it: once one does, it saves the build files this page loaded
    // and, on a plan, the plan, so the first visit already opens offline.
    const controlledAtLoad = Boolean(container.controller);
    const saveThisPage = () => {
      if (controlledAtLoad) return;
      const files = performance.getEntriesByType("resource").map((entry) => entry.name);
      container.controller?.postMessage({ type: "SAVE_PAGE", url: window.location.href, files });
    };
    container.addEventListener("controllerchange", saveThisPage, { once: true });

    let registration: ServiceWorkerRegistration | null = null;
    const offer = (worker: ServiceWorker | null) => {
      if (worker && container.controller) setWaiting(worker);
    };
    const watch = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed") offer(worker);
      });
    };
    const onUpdateFound = () => watch(registration?.installing ?? null);
    container
      .register(serviceWorkerUrl(), { scope: "/" })
      .then((r) => {
        registration = r;
        offer(r.waiting);
        watch(r.installing);
        r.addEventListener("updatefound", onUpdateFound);
      })
      // Blocked (private mode, tests) or offline: the site works the same without it.
      .catch(() => {});
    return () => {
      container.removeEventListener("controllerchange", saveThisPage);
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  if (!waiting) return null;
  const reload = () => {
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  };
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-4 rounded-sm border border-rule bg-paper-raised px-4 py-3 sm:right-auto print:hidden"
    >
      <p className="text-caption text-ink">{m.pwa.updateReady}</p>
      <Button variant="secondary" onClick={reload}>
        {m.pwa.reload}
      </Button>
    </div>
  );
}
