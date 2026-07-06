Generate catalog copy for this product.

Source product data:
{{product_json}}

Return only valid JSON with exactly these string fields:
- description
- seo_title
- seo_meta_description
- image_alt_text

Constraints:
- Description must be 45-80 words.
- SEO title must be under 60 characters.
- SEO meta description must be under 155 characters.
- Image alt text must be factual, specific, and under 125 characters.
- Do not use banned cliches from the brand voice guide.
- Do not include markdown, commentary, or extra keys.
- Do not invent sustainability, origin, fit, sizing, or performance claims that are not in the source data.
