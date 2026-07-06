Review this generated product copy as a senior fashion e-commerce editor.

Look across all descriptions together and flag:
- off-tone writing
- repetitive sentence structures or repeated claims
- inconsistency with the brand voice guide
- invented details not present in the source product data or source URLs
- weak SEO copy or unhelpful image alt text

Return only valid JSON with this shape:
{
  "summary": "Brief review summary.",
  "flagged_items": [
    {
      "id": "product-id",
      "name": "Product name",
      "issue_type": "tone | repetition | consistency | factuality | seo | alt_text",
      "severity": "low | medium | high",
      "notes": "What needs attention.",
      "suggested_fix": "Concise recommended edit."
    }
  ]
}

If there are no issues, return an empty flagged_items array.
