# gemini.md
# Place this file at: .planning/gemini.md
# This file is read by the AI agent at the start of every session.
# It controls how the agent behaves, commits, and logs prompts.

---

## COMMIT BEHAVIOR — READ THIS BEFORE TOUCHING GIT

### The rule: One commit = One meaningful unit of working software

You do not commit after every file change.
You do not commit after every function you write.
You do not commit after fixing a typo.
You do not commit when something is half-done.

You commit when a meaningful, describable piece of work is complete and working.

Ask yourself before every commit:
> "If a senior developer saw this commit in isolation, would it make complete sense as a standalone unit of work?"

If the answer is no — keep working and batch it with the next logical change.

---

### WHAT COUNTS AS ONE COMMIT

Group these together into a single commit:
- Building a feature AND writing its basic test
- Adding an API endpoint AND its input validation
- Creating a component AND hooking it to its data source
- Fixing a bug AND removing the workaround that was covering it
- Setting up a config AND the code that depends on it
- Refactoring a module AND updating the imports that reference it

Do NOT split these across multiple commits.

---

### WHAT NEVER GETS ITS OWN COMMIT

Never make a standalone commit for:
- Adding a single import
- Fixing a console.log or print statement
- Renaming a variable
- Adding a comment
- Moving a file without changing it
- Fixing indentation or formatting alone
- Partially implemented code that does not run
- "WIP" or "in progress" states

If you catch yourself about to make one of these — stop. Hold it and batch it into the next real commit.

---

### COMMIT PACING — TIMING RULES

Minimum time between commits: 8 minutes
Target time between commits: 15–30 minutes
Maximum commits per hour: 4

If you finish something in under 8 minutes, do not commit yet.
Keep working on the next logical piece and commit them together.

This is not artificial slowdown — this is how real developers work.
Real developers think, write, test, adjust, then commit.
They do not commit every 90 seconds.

---

### COMMIT MESSAGE FORMAT — WRITE LIKE A HUMAN DEVELOPER

**Structure:**
```
{verb} {what was built or changed}

{1–3 lines explaining the why or the approach, only if non-obvious}
```

**Rules for the subject line (first line):**
- Start with a lowercase action verb: add, build, fix, wire, connect, refactor, remove, update, implement, integrate, handle, expose, replace, configure, set up
- Do not start with: feat:, fix:, chore:, Update, Added, Fixed (these scream AI or commit-lint bots)
- No brackets, no ticket numbers, no emoji unless the team explicitly uses them
- Keep it under 72 characters
- Do not end with a period

**Rules for the body (optional, only add when genuinely useful):**
- Write it as a human explaining to a teammate, not as documentation
- Explain the decision made, not the code written
- Use plain English, not technical jargon for its own sake
- 1–3 sentences maximum
- Leave a blank line between subject and body

---

### COMMIT MESSAGE EXAMPLES

BAD (do not write these):
```
feat: add user authentication module
```
```
Fixed the login bug and updated some files
```
```
update code
```
```
WIP authentication
```
```
Added login endpoint, updated middleware, fixed token validation, changed response format, updated tests
```

GOOD (write these):
```
add JWT authentication with refresh token support
```
```
wire dashboard to live sales data endpoint

switched from mock data to the /api/v1/sales route,
added loading and error states while the fetch resolves
```
```
fix session expiry crash on mobile browsers

the token check was running before localStorage was available
on some mobile webkit versions, moved it inside a try-catch
```
```
set up Supabase connection and base schema
```
```
integrate demand forecast model into product listing

the model runs on page load and annotates each product
with a confidence score, low-confidence items get flagged
```

---

### BEFORE EVERY COMMIT — MENTAL CHECKLIST

1. Does this code actually run without errors?
2. Is this a complete, describable unit of work?
3. Has it been at least 8 minutes since the last commit?
4. Would this make sense to someone reading the git log tomorrow?
5. Is the commit message written as a human decision, not a file inventory?

All five must be yes. If any are no — do not commit yet.

---

### COMMIT SIZE GUIDELINES

Aim for commits that touch 3–8 files and 50–300 lines changed.

If a commit touches fewer than 2 files and under 20 lines — batch it with the next change.
If a commit touches more than 15 files — consider whether it should be split into two logical units.

---

## PROMPT LOGGING — REQUIRED FOR EVERY SESSION

The hackathon evaluators require that all prompts given to AI tools are recorded.

### WHERE TO LOG

Every prompt you receive from a team member must be logged to:
`.planning/prompt-log.md`

Create this file if it does not exist.

### LOG FORMAT

```
---
Time: {HH:MM}
Member: {name}
Task context: {one line — what they were working on}
Prompt given:
{paste the full prompt exactly as received}
Output summary: {1–2 sentences — what was built or decided as a result}
Files changed: {list of files created or modified}
---
```

### WHEN TO LOG

Log immediately after receiving a prompt, before starting work.
Do not batch prompt logs. Log each one as it happens.

### WHAT THIS PROVES TO EVALUATORS

A prompt log shows:
- The team used AI intentionally, not randomly
- Each prompt was a deliberate decision with a specific goal
- The team understood what they were asking for and why
- AI was a tool, not a replacement for thinking

---

## GENERAL AGENT BEHAVIOR

### Response style
- Be direct. No preamble.
- Show what file you are editing before you edit it.
- When making a decision, state it once — do not ask for permission on obvious calls.
- If two valid approaches exist, pick one and explain why in one sentence.

### Code quality
- Write code that the team can read and understand without asking you
- Use the naming conventions already in the project — do not introduce new patterns mid-build
- Do not install packages without checking .planning/rules.md first
- Do not change files outside the scope of the current task

### Scope discipline
- Work only on the assigned task
- If you discover a bug in code outside your scope, log it in .planning/bugs/ — do not fix it
- If you get an idea for a new feature, run /gsd-add-backlog and move on
- If you realize the task is bigger than expected, surface it immediately — do not silently expand scope

### Priority order
1. MVP core loop working
2. V1 features
3. V2 features
4. Polish and edge cases

Working always beats pretty. Demo-able always beats complete.

### When stuck
If you are blocked for more than 20 minutes on a single problem:
1. Write what you tried in .planning/{member}_context.md
2. Run /gsd-debug to reset your approach
3. Surface the blocker explicitly — do not spiral silently

---

## GIT WORKFLOW

Always work on a feature branch, not directly on main:
```
git checkout -b {member-name}/{feature-name}
```

Before opening a PR:
1. Run /gsd-verify-work to confirm done condition passes
2. Self-review the diff — remove any debug code, commented-out blocks, or console.logs
3. Run /gsd-ship to create the PR

PR title format follows the same rules as commit messages — written as a human decision, not a file inventory.

Never force push to main.
Never merge your own PR — the lead developer reviews and merges.

---

## GSD CONFIGURATION — ACTIVE SETTINGS FOR THIS PROJECT

### Model Profile
Use the **balanced** profile throughout the hackathon:
- Planning phases (discuss, plan): Opus — best thinking for architecture decisions
- Execution phases (execute, quick, fast): Sonnet — fast enough, high quality
- Verification (verify-work, review): Sonnet — sufficient for UAT checks

Switch profile with: `/gsd-set-profile balanced`

Only switch to **budget** (all Sonnet/Haiku) if you are in a time crunch and need raw speed over quality.
Never use **quality** (all Opus) unless it is the architecture phase — it is too slow for execution.

---

### Workflow Toggles (.planning/config.json)
These settings must be active. If config.json does not exist yet, GSD creates it on first run. Confirm these values are set:

```json
{
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "discuss_mode": "discuss"
  },
  "parallelization": {
    "enabled": true
  },
  "git": {
    "branching_strategy": "phase"
  }
}
```

**Why each toggle is set this way:**

`research: true` — Always research before planning. At a hackathon you do not know the domain deeply. Let GSD pull in context before writing task plans.

`plan_check: true` — Verify plans against requirements before executing. Catches scope creep before it wastes build time.

`verifier: true` — Run the verifier after every execute-phase. This is what creates the VERIFICATION.md artifact that proves to evaluators the feature was tested, not just shipped.

`auto_advance: false` — Do NOT auto-chain steps without stopping. You need a human checkpoint between discuss → plan → execute. Stopping between steps is where the team reviews and approves. Auto-advance removes that gate.

`discuss_mode: "discuss"` — Use interview mode (questions to the developer) rather than assumptions mode (agent guesses). At a hackathon, assumptions mode can send you in the wrong direction for 2 hours.

`parallelization: enabled: true` — Multiple independent task plans run simultaneously in execute-phase. Each plan gets its own fresh 200k context window. This is the main speed multiplier — use it.

`branching_strategy: "phase"` — One branch per GSD phase. Keeps PRs reviewable. Prevents the main branch from accumulating half-finished work.

---

### GSD Command Rules — When to Use What

**At project start:**
```
/gsd-map-codebase          if any boilerplate or starter code exists
/gsd-new-project           always — do not start without initializing GSD
```

**Before building any feature:**
```
/gsd-discuss-phase N       capture decisions BEFORE planning — do not skip this
/gsd-plan-phase N          generate task plans AFTER discuss, not before
```
Never run `/gsd-plan-phase` without first running `/gsd-discuss-phase`. Planning without discussion produces plans that miss edge cases and integration points.

**Building:**
```
/gsd-execute-phase N       run all plans — parallelization handles independent tasks simultaneously
/gsd-quick --research      for ad-hoc tasks where you need domain context first
/gsd-quick                 for ad-hoc tasks where the approach is clear
/gsd-fast "task"           only for truly trivial changes (update a config value, rename a route)
```

**Validation — never skip:**
```
/gsd-verify-work N         run after every execute-phase before opening a PR
                           this creates the VERIFICATION.md artifact — evaluators can see it
```

**Feasibility spikes — use early, use often:**
```
/gsd-spike "approach idea"     before committing to an ML model, API design, or architecture pattern
/gsd-sketch "UI idea"          before building a UI component — validates layout in HTML first
```
Run spikes before planning, not during execution. A 15-minute spike saves 2 hours of building the wrong thing.

**Shipping:**
```
/gsd-ship N                creates PR with auto-generated body — always use this, do not open PRs manually
```

**Session boundaries — mandatory:**
```
/gsd-pause-work            run this when stopping for any reason (food, break, sleep)
                           writes HANDOFF.json so the next session knows exactly where to resume
/gsd-resume-work           run this at the START of every new session before anything else
                           restores state from HANDOFF.json
/gsd-progress              run if you are unsure of current state — answers "where am I, what's next"
```

**Parallel workstreams — use for ML + main dev running simultaneously:**
```
/gsd-workstreams create ml-pipeline        member 3 works in this workstream
/gsd-workstreams create main-feature       bhavesh works in this workstream
/gsd-workstreams switch {name}             each member switches to their workstream at session start
/gsd-workstreams complete {name}           when a workstream is done and ready to merge back
```

**Backlog discipline:**
```
/gsd-add-backlog "idea"    any idea that is not in the current phase goes here immediately
/gsd-plant-seed "idea"     forward-looking ideas that belong in V2 or V3
```
Never implement a backlogged idea mid-phase. Log it, move on.

**Debugging:**
```
/gsd-debug "description"   for any bug that is not fixed within 20 minutes of investigation
                           this resets your approach and gives the agent a fresh diagnosis path
```

**Code review:**
```
/gsd-review                run on a phase or branch to get cross-AI peer review before PR merge
                           use this when the lead developer is not available to manually review
```

**Security — run before demo, not after:**
```
/gsd-secure-phase N        run on auth, data handling, and API phases
                           flags obvious vulnerabilities before evaluators or judges find them
```

**Utilities for evaluator artifacts:**
```
/gsd-stats                 generates project stats: phases complete, plans run, git metrics
                           screenshot this for your pitch deck traction slide
/gsd-session-report        end-of-session summary — shows what was built and what changed
                           run this before every break and save the output to .planning/
```

---

### What GSD Creates That Evaluators Can See

Every GSD command leaves artifacts in `.planning/`. These are evidence of structured development:

| Artifact | Created by | Shows evaluators |
|---|---|---|
| `REQUIREMENTS.md` | /gsd-new-project | You scoped the problem before coding |
| `ROADMAP.md` | /gsd-new-project | You planned phases, not random features |
| `{N}-CONTEXT.md` | /gsd-discuss-phase | You made deliberate implementation decisions |
| `{N}-PLAN.md` | /gsd-plan-phase | You broke work into atomic tasks |
| `{N}-VERIFICATION.md` | /gsd-verify-work | You tested before shipping |
| `{N}-UAT.md` | /gsd-verify-work | You ran user acceptance tests |
| `STATE.md` | updated throughout | Your decision trail across the entire project |
| `prompt-log.md` | logged manually | Every AI prompt used — required by evaluators |
| `approach-comparison.md` | architect member | You evaluated options before choosing |
| `ml-module-spec.md` | ML member | The AI component was designed, not guessed |
| `bugs/{feature}-bugs.md` | tester | You found and tracked your own bugs |

Do not delete any `.planning/` files during the hackathon. They are your audit trail.

---

## WHAT THIS FILE IS NOT

This file is not a suggestion. Every rule here is active for this project.
If a rule conflicts with what feels faster in the moment — follow the rule.
The goal is not maximum commits. The goal is maximum trust from evaluators.
