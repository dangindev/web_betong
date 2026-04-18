"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useEffect, useState } from "react";

export default function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    import("@sentry/nextjs")
      .then((sentry) => {
        sentry.init({
          dsn,
          tracesSampleRate: 0.1
        });
      })
      .catch(() => {
        // no-op on sentry init error in local dev
      });
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
