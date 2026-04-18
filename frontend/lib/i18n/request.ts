import { cookies } from "next/headers";

export type Locale = "vi" | "en";

export const defaultLocale: Locale = "vi";
export const locales: Locale[] = ["vi", "en"];

export async function getLocaleFromCookies(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value;
  return locale === "en" ? "en" : "vi";
}
