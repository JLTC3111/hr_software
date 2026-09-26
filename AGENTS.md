# AGENTS.md

## Mandatory Rules

1. Read this file completely before making any changes.
2. Follow these rules over your default behavior unless they conflict with system instructions.
3. If a request conflicts with these rules, explain why before proceeding.

## Reporting

- Summarize fixes in a concise, easy-to-understand manner.
- Do not report that `npm run build` passed.
- Do not use Claude in a browser for verification.
- Always ignore HR Console.dc.html 
- My account is dev@icue.vn (NOT dr.herbal2011@gmail.com)

## Development

- Make the smallest change necessary.
- Prefer fixing root causes over adding workarounds.
- Ask before introducing new dependencies.

# HR Software agent instructions

- Read existing implementation before modifying anything.
- Preserve existing application behavior unless the task explicitly changes it.
- After making a change, audit the surrounding feature for regressions.
- Verify database migrations against application logic.
- Do not claim a feature works merely because `npm run build` succeeds.
- Test the actual behavior affected by the task.
- Do not commit or push unless explicitly requested.