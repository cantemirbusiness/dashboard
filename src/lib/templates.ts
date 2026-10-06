import type { CategoryColor } from "@/lib/domain";

/** Starter skill sets offered during onboarding. Real (non-demo) data, fully editable. */
export const SKILL_TEMPLATES: { key: string; name: string; color: CategoryColor; skills: string[] }[] = [
  { key: "ai", name: "AI Engineering", color: "violet", skills: ["LLM APIs", "RAG", "Agents", "Tool Calling", "AI Architecture"] },
  {
    key: "backend",
    name: "Backend",
    color: "blue",
    skills: ["REST APIs", "Authentication", "Authorization", "Databases", "Error Handling", "Validation", "Testing", "Deployment"],
  },
  { key: "frontend", name: "Frontend", color: "aqua", skills: ["HTML & CSS", "React", "TypeScript", "Accessibility", "UI Design"] },
  { key: "business", name: "Business", color: "orange", skills: ["Product Research", "Offer Design", "Marketing", "Sales", "Distribution"] },
  { key: "communication", name: "Communication", color: "magenta", skills: ["English", "Technical Communication", "Writing"] },
];
