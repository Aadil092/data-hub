import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Head>
          <title>DataHub | Contact Management System</title>
          <meta
            name="description"
            content="CONTACT MANAGEMENT SYSTEM"
          />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favedata.ico" />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var saved = localStorage.getItem('datahub_theme');
                    var theme = saved === 'light' ? 'light' : 'dark';
                    document.documentElement.classList.remove('light', 'dark');
                    document.documentElement.classList.add(theme);
                    document.documentElement.setAttribute('data-theme', theme);
                    document.documentElement.style.colorScheme = theme;
                  } catch (e) {}
                })();
              `,
            }}
          />
        </Head>
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}
