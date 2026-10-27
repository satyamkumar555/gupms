import "./globals.css"; import type { Metadata } from "next"; import { AuthProvider } from "@/lib/auth"; import { SITE } from "@/lib/site";
export const metadata: Metadata = { title: `${SITE.name} ${SITE.title}`, description: `${SITE.name} - ${SITE.title}` };
export default function Root({ children }: { children: React.ReactNode }) { return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>; }
