# Codex Agents For This Repo

This repository defines project-local Codex agents in `.codex/config.toml`.
Each role points to a TOML config layer in `agents/*.toml`, which is the format Codex expects for custom agent roles.

Available agents:
- `math_auditor`: slot math, RNG, paylines, free-spin state, payout invariants
- `ui_audio_reviewer`: rendering, controls, input flow, audio timing, responsive behavior
- `test_guardian`: deterministic regression tests in `scripts/test_*.js`
- `slot_worker`: implementation with minimal vanilla-JS changes

Recommended workflow:
1. Use `math_auditor` and/or `ui_audio_reviewer` to review the current working tree and identify the highest-risk regressions.
2. Use `slot_worker` to implement the smallest acceptable patch.
3. Use `test_guardian` to add or tighten the narrowest deterministic regression tests.

Example prompts:

```text
Use math_auditor and ui_audio_reviewer in parallel to review the current working tree for lever, bonus-pick, auto-spin, and audio regressions. Return only the top 6 findings with file references.
```

```text
Use slot_worker to fix the highest-severity lever or bonus flow issue you found, then use test_guardian to add the narrowest regression test and run only the relevant node tests.
```

```text
Use ui_audio_reviewer to review mobile cabinet behavior, paytable tab interactions, and sound timing. Flag only user-visible regressions.
```

The local config also enables Codex `multi_agent` for this repository.
