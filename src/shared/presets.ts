export type PresetTask = {
  label: string;
  task: string;
};

export const PRESET_TASKS: PresetTask[] = [
  {
    label: "Buyer feedback analyzer",
    task:
      "Analyze mock KHAITE verified-buyer reviews, client service notes, return reasons, and size/fit feedback. Find praise themes, recurring complaints, fit/quality/material issues, PDP copy gaps, product improvement suggestions, and a concise 'what buyers are really saying' summary. Write a final customer intelligence report.",
  },
  {
    label: "PDP copy workflow",
    task:
      "Pull the latest KHAITE new arrivals, extract product details for the first 2 items, generate clean PDP copy in our brand voice, validate SEO limits, flag factual risks, and create a merchandising report.",
  },
  {
    label: "New arrivals analysis",
    task: "Analyze KHAITE new arrivals for the first 2 products",
  },
  {
    label: "Handbag PDP copy",
    task: "Generate PDP copy for handbags",
  },
  {
    label: "SEO risk review",
    task: "Review source copy for SEO risks",
  },
];
