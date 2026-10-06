// Demo workspace generator.
//
// Produces ~7 months of realistic, internally consistent history relative to
// `today`, so the dashboard can be evaluated immediately. Every record is
// flagged `isDemo` and can be removed in one action from Settings.
//
// The story: a developer who learned backend fundamentals, shipped a Task API,
// is now building an AI SaaS, studies agents a lot but rarely builds them,
// keeps up English practice, and has barely touched deployment or sales.

import type {
  Activity,
  ActivityMode,
  ActivityType,
  Evidence,
  Goal,
  Milestone,
  Outcome,
  Project,
  ProjectTrack,
  Skill,
  SkillCategory,
} from "@/lib/domain";
import { addDays } from "@/lib/dates";

export interface DemoData {
  categories: SkillCategory[];
  skills: Skill[];
  projects: Project[];
  goals: Goal[];
  milestones: Milestone[];
  activities: Activity[];
  evidence: Evidence[];
}

/** Small seeded PRNG (mulberry32) so the demo looks the same every time. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDemoData(today: string, newId: () => string = () => crypto.randomUUID()): DemoData {
  const rand = rng(20261006);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const d = (offset: number) => addDays(today, offset);

  // ---- Categories & skills ----
  const cat = (name: string, color: SkillCategory["color"], sortOrder: number): SkillCategory => ({
    id: newId(),
    name,
    color,
    sortOrder,
    isDemo: true,
  });
  const ai = cat("AI Engineering", "violet", 0);
  const be = cat("Backend", "blue", 1);
  const biz = cat("Business", "orange", 2);
  const com = cat("Communication", "aqua", 3);
  const categories = [ai, be, biz, com];

  const skills: Skill[] = [];
  const sk = (name: string, c: SkillCategory, baseline: number, target: number, since = -210, description: string | null = null) => {
    const s: Skill = {
      id: newId(),
      categoryId: c.id,
      name,
      description,
      baselineScore: baseline,
      targetScore: target,
      trackedSince: d(since),
      archived: false,
      isDemo: true,
    };
    skills.push(s);
    return s;
  };
  const llm = sk("LLM APIs", ai, 12, 75, -150, "Calling, prompting and evaluating language models through their APIs.");
  const rag = sk("RAG", ai, 5, 70, -150, "Retrieval-augmented generation: chunking, embeddings, retrieval, grounding.");
  const agents = sk("Agents", ai, 5, 65, -150);
  const tools = sk("Tool Calling", ai, 8, 65, -150);
  const aiArch = sk("AI Architecture", ai, 5, 70, -150);
  const rest = sk("REST APIs", be, 25, 80, -210, "Designing and implementing HTTP APIs.");
  const authn = sk("Authentication", be, 15, 75);
  const authz = sk("Authorization", be, 10, 70);
  const db = sk("Databases", be, 20, 75);
  const testing = sk("Testing", be, 10, 65);
  const deploy = sk("Deployment", be, 8, 70, -210, "Shipping apps to production: containers, CI/CD, hosting, monitoring.");
  const research = sk("Product Research", biz, 15, 60, -120);
  const offer = sk("Offer Design", biz, 5, 60, -120);
  const marketing = sk("Marketing", biz, 5, 55, -120);
  const sales = sk("Sales", biz, 5, 55, -120);
  const english = sk("English", com, 40, 75, -210, "Measured against CEFR. B1 ≈ 45, B2 ≈ 70.");
  const writing = sk("Technical Writing", com, 20, 65, -150);

  // ---- Projects ----
  const track = (projectId: string, name: string, progress: number, sortOrder: number): ProjectTrack => ({
    id: newId(),
    projectId,
    name,
    progress,
    sortOrder,
  });

  const taskApiId = newId();
  const taskApi: Project = {
    id: taskApiId,
    name: "Task API",
    description: "A multi-user task management REST API with JWT auth, role-based permissions and an integration test suite.",
    status: "completed",
    manualProgress: 100,
    startDate: d(-150),
    targetDate: d(-70),
    completedOn: d(-62),
    output: "Public GitHub repository with OpenAPI docs and 84% test coverage.",
    notes: "Took longer than planned because of the permissions model. Worth it.",
    links: ["https://github.com/example/task-api"],
    skillIds: [rest.id, authn.id, authz.id, db.id, testing.id],
    tracks: [],
    isDemo: true,
  };
  taskApi.tracks = [track(taskApiId, "API design", 100, 0), track(taskApiId, "Auth", 100, 1), track(taskApiId, "Tests", 100, 2)];

  const saasId = newId();
  const saas: Project = {
    id: saasId,
    name: "Support Copilot",
    description: "AI SaaS that answers customer-support questions from a company's own docs (RAG + tool calling).",
    status: "active",
    manualProgress: 0,
    startDate: d(-110),
    targetDate: d(45),
    completedOn: null,
    output: null,
    notes: "MVP scope: doc ingestion, chat widget, ticket handoff tool, Stripe billing.",
    links: [],
    skillIds: [llm.id, rag.id, tools.id, aiArch.id, rest.id, authn.id, db.id, deploy.id],
    tracks: [],
    isDemo: true,
  };
  saas.tracks = [
    track(saasId, "Planning", 90, 0),
    track(saasId, "Backend", 65, 1),
    track(saasId, "AI", 72, 2),
    track(saasId, "Frontend", 40, 3),
    track(saasId, "Deployment", 15, 4),
  ];

  const notesId = newId();
  const notes: Project = {
    id: notesId,
    name: "RAG Notes Search",
    description: "Semantic search over personal markdown notes.",
    status: "paused",
    manualProgress: 55,
    startDate: d(-140),
    targetDate: d(-90),
    completedOn: null,
    output: null,
    notes: "Paused to focus on Support Copilot — most of the retrieval code moved there.",
    links: [],
    skillIds: [rag.id, llm.id],
    tracks: [],
    isDemo: true,
  };

  const landingId = newId();
  const landing: Project = {
    id: landingId,
    name: "Copilot landing page & waitlist",
    description: "Positioning, pricing hypothesis and a waitlist to validate demand before launch.",
    status: "planning",
    manualProgress: 10,
    startDate: d(-20),
    targetDate: d(30),
    completedOn: null,
    output: null,
    notes: null,
    links: [],
    skillIds: [research.id, offer.id, marketing.id],
    tracks: [],
    isDemo: true,
  };
  const projects = [saas, taskApi, notes, landing];

  // ---- Goals ----
  const goal = (g: Omit<Goal, "id" | "isDemo" | "completedOn" | "state" | "categoryId"> & Partial<Goal>): Goal => ({
    id: newId(),
    isDemo: true,
    completedOn: null,
    state: "active",
    categoryId: null,
    ...g,
  });
  const gMvp = goal({
    title: "Ship the Support Copilot MVP",
    description: "Paying-ready MVP in production with the first real users.",
    horizon: "short",
    measure: "milestones",
    unit: null,
    startValue: 0,
    currentValue: 0,
    targetValue: 100,
    startDate: d(-110),
    deadline: d(45),
    priority: "high",
    skillIds: [llm.id, rag.id, tools.id, deploy.id],
    projectIds: [saasId],
    categoryId: ai.id,
  });
  const gBackend = goal({
    title: "Become a solid backend engineer",
    description: "Able to design, secure, test and ship a production backend without hand-holding.",
    horizon: "long",
    measure: "skills",
    unit: null,
    startValue: 0,
    currentValue: 0,
    targetValue: 70,
    startDate: d(-210),
    deadline: d(240),
    priority: "high",
    skillIds: [rest.id, authn.id, authz.id, db.id, testing.id, deploy.id],
    projectIds: [taskApiId, saasId],
    categoryId: be.id,
  });
  const gEnglish = goal({
    title: "Reach B2 English",
    description: "Comfortable in technical meetings and interviews in English.",
    horizon: "long",
    measure: "skills",
    unit: null,
    startValue: 0,
    currentValue: 0,
    targetValue: 70,
    startDate: d(-210),
    deadline: d(250),
    priority: "medium",
    skillIds: [english.id],
    projectIds: [],
    categoryId: com.id,
  });
  const gMoney = goal({
    title: "Earn the first €1,000 from my own product",
    description: null,
    horizon: "long",
    measure: "manual",
    unit: "€",
    startValue: 0,
    currentValue: 0,
    targetValue: 1000,
    startDate: d(-60),
    deadline: d(200),
    priority: "medium",
    skillIds: [sales.id, marketing.id, offer.id],
    projectIds: [saasId, landingId],
    categoryId: biz.id,
  });
  const gAi = goal({
    title: "Solid AI engineering foundations",
    description: "Able to design and build reliable LLM features end-to-end.",
    horizon: "long",
    measure: "skills",
    unit: null,
    startValue: 0,
    currentValue: 0,
    targetValue: 65,
    startDate: d(-150),
    deadline: null,
    priority: "medium",
    skillIds: [llm.id, rag.id, agents.id, tools.id, aiArch.id],
    projectIds: [saasId],
    categoryId: ai.id,
  });
  const goals = [gMvp, gBackend, gEnglish, gMoney, gAi];

  // ---- Milestones ----
  const ms = (m: Omit<Milestone, "id" | "isDemo" | "description"> & { description?: string | null }): Milestone => ({
    id: newId(),
    isDemo: true,
    description: null,
    ...m,
  });
  const milestones: Milestone[] = [
    ms({ title: "Auth & multi-tenancy working", goalId: gMvp.id, projectId: saasId, skillId: authn.id, dueOn: d(-60), achievedOn: d(-58), significance: 2 }),
    ms({ title: "RAG pipeline answers from real docs", goalId: gMvp.id, projectId: saasId, skillId: rag.id, dueOn: d(-30), achievedOn: d(-24), significance: 3 }),
    ms({ title: "Stripe billing", goalId: gMvp.id, projectId: saasId, skillId: null, dueOn: d(10), achievedOn: null, significance: 2 }),
    ms({ title: "Deploy to production", goalId: gMvp.id, projectId: saasId, skillId: deploy.id, dueOn: d(20), achievedOn: null, significance: 3 }),
    ms({ title: "First 10 real users", goalId: gMvp.id, projectId: saasId, skillId: null, dueOn: d(45), achievedOn: null, significance: 3 }),
    ms({ title: "Completed backend foundation", description: "Finished the backend curriculum and shipped the Task API.", goalId: gBackend.id, projectId: null, skillId: rest.id, dueOn: null, achievedOn: d(-62), significance: 3 }),
    ms({ title: "Reached B1 English", goalId: gEnglish.id, projectId: null, skillId: english.id, dueOn: null, achievedOn: d(-120), significance: 2 }),
    ms({ title: "Reached B2 English", goalId: gEnglish.id, projectId: null, skillId: english.id, dueOn: d(250), achievedOn: null, significance: 3 }),
    ms({ title: "First € earned", goalId: gMoney.id, projectId: null, skillId: sales.id, dueOn: d(90), achievedOn: null, significance: 3 }),
  ];

  // ---- Activities ----
  const activities: Activity[] = [];
  const act = (
    day: number,
    title: string,
    type: ActivityType,
    mode: ActivityMode,
    minutes: number,
    skillIds: string[],
    opts: { difficulty?: number; outcome?: Outcome; projectId?: string | null; description?: string } = {},
  ) => {
    const a: Activity = {
      id: newId(),
      occurredOn: d(day),
      title,
      description: opts.description ?? null,
      type,
      mode,
      projectId: opts.projectId ?? null,
      durationMinutes: minutes,
      difficulty: (opts.difficulty ?? 3) as Activity["difficulty"],
      outcome: opts.outcome ?? "partial",
      notes: null,
      skillIds,
      isDemo: true,
      createdAt: `${d(day)}T18:00:00Z`,
    };
    activities.push(a);
    return a;
  };
  const mins = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) / 15) * 15;

  for (let day = -210; day <= 0; day++) {
    // ~5–6 active days a week, with a quieter stretch around day −100.
    const activeChance = day > -110 && day < -95 ? 0.35 : day > -14 ? 0.85 : 0.72;
    if (rand() > activeChance) continue;

    // English: steady practice, ~3x a week.
    if (rand() < 0.42) {
      const kind = pick([
        ["Conversation practice with tutor", "practice", 60],
        ["Listening: tech podcast + shadowing", "practice", 45],
        ["Grammar unit", "knowledge", 40],
        ["Wrote and corrected an English essay", "practice", 50],
      ] as const);
      act(day, kind[0], "english", kind[1], mins(kind[2] - 15, kind[2] + 15), [english.id], { difficulty: 3, outcome: "completed" });
    }

    if (day < -150) {
      // Phase 1: backend fundamentals (mostly study, some exercises).
      const opt = pick([
        ["HTTP & REST design course", "learning", "knowledge", [rest.id]],
        ["SQL & data modelling chapter", "learning", "knowledge", [db.id]],
        ["Auth fundamentals: sessions vs JWT", "learning", "knowledge", [authn.id]],
        ["SQL exercises", "practice", "practice", [db.id]],
        ["Built CRUD endpoints exercise", "practice", "practice", [rest.id]],
      ] as const);
      act(day, opt[0], opt[1], opt[2], mins(60, 120), [...opt[3]], { difficulty: 2 });
    } else if (day < -62) {
      // Phase 2: Task API project.
      const opt = pick([
        ["Task API: endpoints & validation", [rest.id], 3],
        ["Task API: JWT login & refresh tokens", [authn.id], 4],
        ["Task API: role-based permissions", [authz.id], 4],
        ["Task API: schema & migrations", [db.id], 3],
        ["Task API: integration tests", [testing.id], 3],
      ] as const);
      act(day, opt[0], "coding", "execution", mins(75, 180), [...opt[1]], { difficulty: opt[2], projectId: taskApiId, outcome: rand() < 0.3 ? "completed" : "partial" });
      if (day > -140 && day < -95 && rand() < 0.35) {
        act(day, "Embeddings & vector search tutorial", "learning", "knowledge", mins(45, 90), [rag.id, llm.id], { projectId: notesId });
      }
    } else {
      // Phase 3: Support Copilot + lots of agent theory.
      const opt = pick([
        ["Copilot: ingestion & chunking pipeline", [rag.id], 4],
        ["Copilot: prompt templates & evals", [llm.id], 3],
        ["Copilot: ticket handoff tool", [tools.id], 4],
        ["Copilot: tenant-scoped API", [rest.id, authz.id], 3],
        ["Copilot: Postgres + pgvector schema", [db.id, rag.id], 3],
        ["Copilot: system design doc", [aiArch.id], 3],
      ] as const);
      act(day, opt[0], "project", "execution", mins(90, 180), [...opt[1]], { difficulty: opt[2], projectId: saasId, outcome: rand() < 0.25 ? "completed" : "partial" });
      if (rand() < 0.55) {
        const theory = pick([
          "Read: agent architectures paper",
          "Course: building LLM agents, module",
          "Video: multi-agent orchestration patterns",
        ]);
        act(day, theory, "learning", "knowledge", mins(45, 120), [agents.id]);
      }
    }
  }

  // Sparse, deliberate records that shape the story.
  act(-170, "Docker crash course", "learning", "knowledge", 120, [deploy.id], { difficulty: 2 });
  act(-120, "Read: CI/CD with GitHub Actions", "learning", "knowledge", 60, [deploy.id], { difficulty: 2 });
  act(-41, "Docker fundamentals course (finished)", "learning", "knowledge", 150, [deploy.id], { difficulty: 2, outcome: "completed" });
  act(-18, "Tried deploying Copilot to Fly.io — stuck on secrets", "project", "execution", 75, [deploy.id], { difficulty: 4, outcome: "none", projectId: saasId });
  act(-95, "Customer interviews (3 support leads)", "business", "practice", 120, [research.id], { difficulty: 3, outcome: "completed" });
  act(-80, "Read: \"Obviously Awesome\" positioning", "learning", "knowledge", 90, [marketing.id, offer.id]);
  act(-12, "Competitor teardown: support AI tools", "research", "knowledge", 90, [research.id, offer.id], { projectId: landingId });
  act(-5, "Drafted pricing tiers", "business", "practice", 60, [offer.id], { projectId: landingId });
  act(-26, "Blog post: how chunking affects RAG answers", "practice", "practice", 150, [writing.id, rag.id], { outcome: "shipped" });
  act(-2, "Copilot: streaming responses in chat widget", "project", "execution", 150, [llm.id], { difficulty: 4, projectId: saasId, outcome: "completed" });
  act(-1, "Copilot: retrieval eval set (40 questions)", "project", "execution", 120, [rag.id, llm.id], { difficulty: 4, projectId: saasId, outcome: "completed" });
  act(0, "Copilot: tool-call retries & error handling", "coding", "execution", 90, [tools.id], { difficulty: 3, projectId: saasId });

  activities.sort((x, y) => (x.occurredOn < y.occurredOn ? -1 : 1));

  // ---- Evidence ----
  const ev = (e: Omit<Evidence, "id" | "isDemo" | "activityId" | "milestoneId" | "description" | "assessmentScore" | "url" | "projectId"> & Partial<Evidence>): Evidence => ({
    id: newId(),
    isDemo: true,
    activityId: null,
    milestoneId: null,
    projectId: null,
    description: null,
    assessmentScore: null,
    url: null,
    ...e,
  });
  const evidence: Evidence[] = [
    ev({ title: "Task API repository", kind: "repository", url: "https://github.com/example/task-api", occurredOn: d(-62), projectId: taskApiId, skillIds: [rest.id, authn.id, authz.id, db.id, testing.id] }),
    ev({ title: "Role-based permissions implementation", kind: "implementation", occurredOn: d(-80), projectId: taskApiId, skillIds: [authz.id], description: "Policy layer with per-resource checks and tests." }),
    ev({ title: "Integration test suite (84% coverage)", kind: "implementation", occurredOn: d(-64), projectId: taskApiId, skillIds: [testing.id] }),
    ev({ title: "EF SET English test", kind: "assessment", assessmentScore: 48, occurredOn: d(-125), skillIds: [english.id] }),
    ev({ title: "EF SET English test (retake)", kind: "assessment", assessmentScore: 58, occurredOn: d(-15), skillIds: [english.id] }),
    ev({ title: "Blog: How chunking affects RAG answers", kind: "writeup", url: "https://example.com/blog/rag-chunking", occurredOn: d(-26), skillIds: [rag.id, writing.id] }),
    ev({ title: "Docker fundamentals certificate", kind: "course", occurredOn: d(-41), skillIds: [deploy.id] }),
    ev({ title: "RAG pipeline demo video", kind: "implementation", occurredOn: d(-24), projectId: saasId, skillIds: [rag.id, llm.id], milestoneId: milestones[1].id }),
    ev({ title: "Interview notes: 3 support leads", kind: "writeup", occurredOn: d(-95), skillIds: [research.id] }),
  ];

  return { categories, skills, projects, goals, milestones, activities, evidence };
}
