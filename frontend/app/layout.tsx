import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import { AppShell } from "@/components/layout/app-shell";
import { getLocaleFromCookies } from "@/lib/i18n/request";

import "./globals.css";
import "leaflet/dist/leaflet.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "web_betong",
  description: "Dispatch and costing platform"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocaleFromCookies();
  const messages = (await import(`../messages/${locale}.json`)).default;

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
