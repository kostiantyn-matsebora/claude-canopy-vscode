# CREATE

Create a new Canopy skill from a description.

1. If no description given, ask for it.
2. Derive a kebab-case skill name from the description, or ask if ambiguous.
3. Read `policies/platform-targeting.md` and resolve the target platform and skills base path. Check if `<skills_base>/<skill_name>/` already exists — if so, offer MODIFY instead.
4. Ask: **"Which tree syntax? | Markdown list (`*`) | Box-drawing (tree characters)"**
5. Analyze the description:
   - Read `policies/category-decision-flowchart.md` to classify each content block
   - Read `policies/authoring-rules.md` for SKILL.md composition and writing rules
   - Identify purpose, inputs, outputs, key decision points, and phases
   - Determine whether an explore subagent is needed (the skill must read project files before acting)
   - Identify which steps should become named ops in `ops.md`
   - Identify which structured content belongs in category subdirs
6. Read `references/framework-ops.md` (framework primitives, inside `canopy-agent`) and any consumer-defined cross-skill ops the user mentions.
   - For each candidate op: if an equivalent already exists in framework primitives or consumer-shared ops, reference it — do not redefine it skill-locally
   - For each candidate resource file: if equivalent content already exists elsewhere, reference that file — do not duplicate it
7. Show plan: skill name | tree structure preview | files to create (marking shared references vs new files). Then emit an apply block per `constants/apply-block-protocol.md` with fields: `op: CREATE` | `skill: <name>` | `tree-syntax: <markdown-list|box-drawing>` | `changes`.
8. Ask: **"Proceed? | Yes | Adjust plan | No"** — if adjusting, accept clarifications and re-show plan.
9. Generate and write files:
   - `SKILL.md` — agentskills.io frontmatter (`name`, `description`) inferred from description; Tree, Rules, Response sections
   - `ops.md` — only for ops not already covered; nodes must comply with the same `policies/authoring-rules.md` constraints as `SKILL.md` tree nodes
   - Category subdir files — only for content not already available elsewhere
10. After writing, run VALIDATE inline. Report any issues.
11. Verify result against `verify/create-expected.md`.
12. Report: **Summary / Files created / Shared references used / Next steps**

**SKILL.md must contain only orchestration, tree nodes must be short and scannable** — see `policies/authoring-rules.md`.
