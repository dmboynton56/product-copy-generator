import { z } from "zod";

const SearchWebInputSchema = z.object({
  query: z.string(),
  allowed_domains: z.array(z.string()).optional(),
});

export async function searchWeb(input: unknown) {
  const parsed = SearchWebInputSchema.parse(input);
  const allowedDomains = parsed.allowed_domains ?? ["khaite.com"];
  const query = parsed.query.toLowerCase();

  const defaults = [
    {
      title: "New Arrivals from KHAITE",
      url: "https://khaite.com/collections/new",
      snippet: "Latest KHAITE new arrivals collection.",
    },
    {
      title: "KHAITE Handbags",
      url: "https://khaite.com/collections/handbags",
      snippet: "Handbags collection for catalog copy review.",
    },
  ];

  const results = defaults.filter((result) => {
    const hostname = new URL(result.url).hostname;
    return (
      allowedDomains.some((domain) => hostname.includes(domain.replace(/^www\./, ""))) &&
      (query.includes("new") ||
        query.includes("handbag") ||
        query.includes("khaite") ||
        query.includes("collection"))
    );
  });

  return {
    query: parsed.query,
    results: results.length > 0 ? results : defaults.slice(0, 1),
  };
}
