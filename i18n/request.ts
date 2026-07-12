import { getRequestConfig } from "next-intl/server";

// Sin routing por locale: la UI arranca en español; el catalán se activará
// con selector de idioma (PRD §4) sin cambiar URLs.
export default getRequestConfig(async () => {
  const locale = "es";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
