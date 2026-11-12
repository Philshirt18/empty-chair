# Devpost submission text

Category: **Apps for Software Teams**
Bonus prizes to tick: Best Rovo agent, Best app with Atlassian MCP, Best use of Teamwork Graph, Best Marketplace published app (only once a listing or review ticket exists).
Top image: screenshot of the round table on the RFC page (5 teams, Team Atlas listening).

## Tagline

See who is affected by a decision, but not at the table.

## Inspiration

Most bad decisions aren't bad because of the people in the room. They're bad because of the people who weren't. A platform team retires an API, and the finance team that exports invoices through it finds out the day before. The information was always there: open Jira issues, support requests, a runbook in another space. Nobody connected it to the decision page.

## What it does

Empty Chair adds a byline item to every Confluence page. On a proposal, RFC, or decision record, it shows a round table:

- **Seated:** teams that commented on or edited the page.
- **Listening:** teams where someone read the page, according to the Teamwork Graph, but nobody has said anything.
- **Empty chairs:** teams whose work depends on what the decision changes, but who haven't joined.

Each team comes with evidence (the Jira issues, service requests, and Confluence pages that depend on the change) and the people to ask. One click drafts a specific invitation for each missing team and a short nudge for each listening team. After you review them, Empty Chair posts one page comment that mentions the right people.

The same check is available as a Rovo agent ("Who is missing from this decision?", "Which open decisions have empty chairs?") and as an Atlassian MCP server, so tools like Claude can call it too.

## How we built it

Empty Chair is a Forge app that runs entirely on Atlassian.

- **Confluence byline item** with a Custom UI panel (React, TypeScript, Vite) and a live title such as "3 empty chairs".
- **Forge LLMs** read the page and extract what the decision changes, keeping only the things that change and leaving out replacements and background. They also write one-line reasons, invitations, and nudges, using only the evidence found.
- **Jira, Jira Service Management, and Confluence REST APIs** find the work that depends on those subjects and group it by team.
- **Teamwork Graph** (persisted Cypher queries) answers who viewed the page in the last 30 days and which Atlassian teams people belong to.
- **Rovo agent and actions**, plus a **`rovo:mcp`** module exposing the same three tools.
- **Forge KVS** caches each analysis per page version.

Every call runs as the current user, so Empty Chair only shows what that person can already see.

## How it meets the technology requirement

Empty Chair is built on Forge and uses only Atlassian-hosted capabilities: Forge functions, Custom UI, Forge LLMs, Forge KVS, the Teamwork Graph API, Rovo agent and action modules, and the Forge MCP module. It has no external services and no egress, so it qualifies for Runs on Atlassian.

## Challenges we ran into

- **Not overclaiming.** "Haven't seen it" became "haven't joined", because a missing comment doesn't prove someone didn't read the page. When the Teamwork Graph can't answer, the panel says so instead of treating it as "nobody read it".
- **The author problem.** On small teams the decision's author also files tickets for other teams. Those tickets must not make the other team look involved, so the author counts as a team member only when assigned to that team's work.
- **Tone.** Nudges for teams that read but stayed quiet are two sentences long and avoid any wording that sounds like tracking.
- **Platform details.** Scopes that don't match an endpoint show up as a consent loop rather than an error. Per-call logging was the only reliable way to find out which call was failing.

## Accomplishments that we're proud of

- A result you understand in two seconds: the round table.
- Evidence for every claim, and nothing posted without confirmation.
- One analysis engine behind the panel, the Rovo agent, and the MCP server.

## What we learned

The Teamwork Graph changes what an app can know about collaboration. "Who read this?" used to be guesswork. Now it's a query, which also means an app has to be careful about how it uses the answer.

## What's next

- A space-level view that lists open decisions with empty chairs.
- Reminders when a decision moves to "decided" while chairs are still empty.
- Jira-side entry point: from an epic, see which decisions affect it.

## Built with

forge, react, typescript, vite, rovo, teamwork-graph, forge-llm, mcp, jira, confluence, jira-service-management
