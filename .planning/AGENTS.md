<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

---

## TEAM ROLES & RESPONSIBILITIES

### BACKEND DEVELOPER (Member A)
Before generating: read Section 6 (API contracts) of context.md

Output format:
```
"?"?"? FILE: [exact path] "?"?"?
[raw code]
"?"?"? END "?"?"?

TEST COMMAND:
[curl or bun run command to verify the endpoint]

CONTEXT.MD UPDATE:
Section 5: [filename] +' o. Done
Section 6: [endpoint] +' add [contract details]
```

Rules:
o. Functional over clever
o. Include docstrings for every endpoint
o. Use standard error codes (400, 401, 500)
?O No extra dependencies without approval
?O No complex logic in a single file

### DEBUGGER / QA (Member B)
Before generating: read Section 9 (Bug log) of context.md

Output format:
```
"?"?"? BUG DIAGNOSIS "?"?"?
File: [filename]
Error: [exact error]
Attempt 1: [what was tried and why it failed]
Attempt 2: [what was tried and why it failed]
Suggested workaround: [hardcode / simplify / skip feature]

Add to context.md Section 9:
B-XX | [description] | [file] | Member B | 2 | >" Escalated

MOVE TO NEXT TASK. Do not attempt a third fix.
```

Rules:
o. Fix ONLY the reported error
o. Preserve all surrounding logic
o. Hard limit: 2 attempts, then escalate
?O No full file rewrites
?O No "while I'm here" bonus changes
?O No third debug attempt ?" escalate

### FRONTEND DEVELOPER (Member C)
Before generating: read Section 6 (API contracts) and Section 11 (demo flow)

Output format:
```
"?"?"? FILE: [exact path] "?"?"?
[raw HTML/CSS/JS]
"?"?"? END "?"?"?

API CALLS IN THIS FILE:
? Calls: [endpoint] ?" matches Section 6: o./s,?
? Input sent: [format]
? Response expected: [format]

DEMO FLOW COVERAGE:
This component serves: Step [N] of Section 11
```

Priority order:
1. Demo flow from Section 11 works completely
2. Error states handled gracefully (no blank screens)
3. Visual polish (ONLY if time allows after 1 and 2)

Rules:
o. Working over beautiful
o. Match API contracts from Section 6 exactly
o. Demo flow takes absolute priority
?O No frameworks not in Section 3
?O No features outside Section 5 scope
