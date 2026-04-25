# Project Rules — AI Ambulance

## General Principles
1. **Demo First**: Every decision must prioritize "Will this look good and work smoothly in the 10-minute demo?"
2. **Speed Over Elegance**: Avoid complex abstractions. Use the provided tech stack (Next.js, Hono, Supabase) to deliver features fast.
3. **Parallel Workflow**: Respect the API contracts defined in `.planning/context.md` (or similar) to allow backend and frontend to work simultaneously.
4. **No Placeholders**: Never use "lorem ipsum" or dummy images. Generate realistic data using `Faker.js` or `generate_image`.
5. **NO SIMULATION / NO FAKING**: If a real API (Gemini, ORS, Supabase) is not working, do NOT simulate its response with hardcoded/mock data. Instead, return a clear error message to the caller (e.g., `{ error: "Gemini API unreachable" }`). The system must fail honestly — never pretend a feature works by faking the response. The only exception is `simulator.js`, which is explicitly a testing tool for GPS movement.

## Git & Commits
1. **Commit Pacing**: Minimum 8 minutes between commits. Max 4 per hour.
2. **Human Messages**: Use lowercase action verbs. Avoid "feat:", "fix:", "chore:".
3. **Group Changes**: Combine logical units (e.g., UI component + its API hook) into a single commit.

## Code Quality
1. **Types over Comments**: Use TypeScript interfaces to document API contracts and state.
2. **Standard Error Handling**: Always include `try-catch` and meaningful UI feedback for API failures.
3. **Atomic Components**: Keep React components small and focused. Reuse `shadcn/ui` patterns.

## GSD Compliance
1. **Prompt Logging**: Log all prompts to `.planning/prompt-log.md` immediately.
2. **State Sync**: Update `context.md` (and individual member context files) after every completed task.
3. **Verification**: Run `/gsd-verify-work` before merging any feature.
