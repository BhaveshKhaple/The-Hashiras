# GSD Prompt Factory — Practical Usage Guide

This guide explains how to actually use the **GSD Hackathon Gem** in a real team workflow. It translates the specification into operational steps so your team can execute without confusion.

---

## 1. What This Gem Actually Does

The Gem is not a coding assistant.

It is a **prompt generator layer** that sits between:
- Your team members
- Your AI coding agents (Claude Code, Gemini CLI, Cursor, etc.)

**Function:**
It converts vague human instructions → structured, executable prompts with:
- Context awareness
- Clear steps
- Defined done conditions
- GSD command integration

---

## 2. Where It Fits in Your Stack

```
Human (Team Member)
        ↓
GSD Prompt Factory (Gem)
        ↓
AI Coding Agent (Gemini CLI / Claude Code)
        ↓
Codebase + GSD Framework
```

You NEVER code directly through the Gem.
You ALWAYS:
1. Ask Gem → get prompt
2. Paste prompt into coding agent
3. Execute

---

## 3. Initial Setup (One-Time)

### Step 1 — Create Gem
- Open Gemini → Gems
- Create New Gem
- Name: `GSD Prompt Factory`
- Paste full content from file: fileciteturn0file0 into Instructions

### Step 2 — Install GSD
Run in your project:

```bash
npx get-shit-done-cc@latest
```

### Step 3 — Choose Runtime
Pick ONE:
- Gemini CLI
- Claude Code
- Cursor / Windsurf

### Step 4 — Initialize Project
In your coding agent:

```bash
/gsd-new-project
```

---

## 4. Team Workflow (Core Loop)

Each team member follows this exact loop:

### Step A — Ask Gem
Example:
> "I want to build login API"

Gem will NOT generate immediately.
It will ask:
- Who are you?
- What is your role?
- What exactly is the task?
- What exists already?

### Step B — Answer Precisely
Example:
> "I'm Arjun, backend developer. Need JWT login API. Node + Express. User model exists."

### Step C — Receive Prompt
Gem generates a **fully structured prompt**.

### Step D — Paste into Coding Agent
Paste into:
- Gemini CLI
- Claude Code

### Step E — Execute
Agent runs:
- Planning
- Implementation
- Verification

### Step F — Repeat
Next task → repeat cycle

---

## 5. Role-Based Usage

### Backend Developer
Use Gem for:
- API endpoints
- Auth systems
- DB schema changes
- Integrations

### Frontend Developer
Use Gem for:
- UI components
- State management
- API integration
- Responsive design fixes

### ML Engineer
Use Gem for:
- RAG pipelines
- Model interfaces
- Inference APIs
- Evaluation pipelines

### Team Lead (You)
Use Gem for:
- Task orchestration
- Breaking work into phases
- Assigning prompts to members
- Managing dependencies

---

## 6. Key Operating Principles

### 1. Never Skip Context
Every prompt includes:
- Project state
- Existing files
- Integration points

This prevents hallucination.

### 2. Always Define DONE
Every task must be verifiable:
- Endpoint returns 200
- UI renders correctly
- Tests pass

### 3. Small Atomic Tasks
Bad:
> "Build entire dashboard"

Good:
> "Create dashboard layout component"

### 4. Use GSD Commands Strictly
Do not improvise workflow.

Example flow:
```
/gsd-discuss-phase
/gsd-plan-phase
/gsd-execute-phase
/gsd-verify-work
```

---

## 7. Multi-Person Coordination

Each member maintains:
```
.planning/{name}_context.md
```

This enables:
- Zero re-explanation
- Shared memory
- Parallel development

### Example Entry
```
[2026-04-25 14:30] Task: Login API | Status: DONE | Output: auth.js, JWT middleware
```

---

## 8. Handling Large Tasks

Gem will split into:
- PROMPT 1 OF N
- PROMPT 2 OF N

Rule:
- NEVER jump ahead
- Complete sequentially

---

## 9. Debugging Workflow

If something breaks:

Ask Gem:
> "Fix login API crash"

Provide:
- Error message
- Trigger
- Expected vs actual

Gem will generate:
```
/gsd-debug "issue"
```

---

## 10. When to Use Each Pattern

| Situation | Pattern |
|----------|--------|
| New project | Initialization |
| Feature build | Feature Pattern |
| ML module | ML Pattern |
| Bug | Debug Pattern |
| Testing | Testing Pattern |
| Small task | Quick Pattern |

---

## 11. Common Mistakes (Avoid These)

❌ Giving vague tasks
❌ Not providing current state
❌ Skipping error logs
❌ Asking multiple tasks at once
❌ Not verifying done condition

---

## 12. Example End-to-End Flow

1. You (Lead):
   > "We need authentication system"

2. Gem → asks clarifying questions

3. You answer clearly

4. Gem generates prompts for:
   - Backend dev (API)
   - Frontend dev (UI)
   - ML (optional user scoring)

5. Each member executes independently

6. All updates tracked in `.planning/`

7. Final:
```
/gsd-verify-work
/gsd-ship
```

---

## 13. Advanced Usage (Important for You)

Since you're leading a **multi-agent hackathon system**, use this pattern:

### Central Control
You DO NOT code.
You ONLY:
- Request prompts
- Distribute prompts
- Track completion

### Parallel Execution
Different members can run:
- Different phases
- Different modules

### Real-Time Coordination
Combine with:
- GitHub branches
- Context files
- GSD workstreams

---

## 14. Minimal Mental Model

Think of the Gem as:

> "Compiler for human intent into executable AI instructions"

---

## 15. Final Checklist Before Using

- [ ] Gem created with full instructions
- [ ] GSD installed
- [ ] Runtime selected
- [ ] Team roles defined
- [ ] Everyone understands prompt → agent workflow

---

## Bottom Line

If used correctly:
- No ambiguity
- No duplicated work
- No broken integration
- Maximum parallel execution

If used incorrectly:
- Chaos
- Conflicting code
- Debugging hell

---

If you want, next step I can:
- Simulate your exact team setup
- Assign roles
- Generate your first real prompts
- Design GitHub + branch + workflow strategy

