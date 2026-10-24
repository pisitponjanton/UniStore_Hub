import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SessionBootstrap } from "@/modules/auth";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: "UniStore Hub",
  description: "University store and pre-order management",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <SessionBootstrap>{children}</SessionBootstrap>
        </ThemeProvider>
      </body>
    </html>
  );
}
