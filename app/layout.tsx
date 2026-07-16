import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Geist_Mono, Karla } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

// Solo para el wordmark: subset mínimo con los glifos de la marca
const wordmark = Bricolage_Grotesque({
  variable: "--font-wordmark",
  weight: "800",
  text: "RUMBO",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RUMBO — Formación y servicios náuticos",
    template: "%s · RUMBO",
  },
  description:
    "Estudia el PER a tu ritmo: lecciones interactivas, flashcards con repetición espaciada, simulacros de examen por comunidad autónoma y toda la información del título al día.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${karla.variable} ${fraunces.variable} ${wordmark.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
