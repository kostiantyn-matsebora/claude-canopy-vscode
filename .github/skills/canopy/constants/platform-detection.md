# Platform Detection

Map directory presence → platform availability. The active execution platform is whichever base directory the agent was invoked from.

| Directory present | Platform |
|-------------------|----------|
| `.claude/` | `claude` |
| `.github/` | `copilot` |

`available_platforms` is the set of platforms whose directory exists. A repo can have both, one, or neither (in the "neither" case, SCAFFOLD/CREATE ask which to initialise).
