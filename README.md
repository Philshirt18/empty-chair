# Empty Chair

**See who is affected by a decision, but not at the table.**

Empty Chair is a Forge app for Confluence. Open any proposal, RFC, or decision page and it shows a round table: teams that are part of the conversation sit at it, teams that read the page but stayed quiet are listening, and teams whose work depends on the decision but who have not joined yet are empty chairs. One click drafts a specific invitation for each missing team and a gentle nudge for each quiet one, and posts them as a page comment that mentions the right people.

## How it works

1. **Read the decision.** Forge LLMs read the page and extract what the decision changes, for example "Payments API v1". Replacements and background are left out on purpose.
2. **Follow the work.** Jira issues, service requests, and Confluence pages that mention those subjects are found and grouped by team. Groups built from projects or spaces take an Atlassian team's name when the people doing the work share one in the Teamwork Graph.
3. **Check who is at the table.** A team is seated when someone from it wrote, edited, or commented on the page. It is listening when the **Teamwork Graph** shows that someone from it viewed the page in the last 30 days without commenting. Otherwise its chair is empty.
4. **Invite.** Invitations and nudges are drafted per team from the evidence, can be edited, and are only posted after confirmation.

The decision's own author filing tickets for other teams does not seat those teams. Graph failures are reported, never treated as "nobody read it".

## Atlassian platform features used

| Feature | Use |
|---|---|
| `confluence:contentBylineItem` (Custom UI, modal) | The panel, and a live byline title such as "3 empty chairs" |
| Forge LLMs (`llm` module) | Subject extraction, one-line reasons, invitations, nudges |
| Teamwork Graph API (persisted Cypher queries) | Who viewed the page; which Atlassian teams people belong to |
| Jira and Jira Service Management REST APIs | Open issues and customer requests that depend on the decision |
| Confluence REST APIs | Page content, comments, versions, watchers, related pages, posting the comment |
| `rovo:agent` and `action` modules | "Who is missing from this decision?" and "Draft an invite for this team" |
| `rovo:mcp` module | The same two tools for external MCP clients |
| Forge KVS | Caching analyses per page version |

All reads run as the current user, so Empty Chair only shows what that user can already see. The app runs entirely on Atlassian: no external services.

## Testing instructions for judges

### Install

1. Open the installation link from the submission.
2. Install into **both Confluence and Jira** on the same site. Jira Service Management is optional but recommended.
3. Installing apps with Teamwork Graph scopes requires **organization admin** permissions on the site.

### Fastest way: the demo company

1. Open any Confluence page and click **Empty Chair** in the byline under the title.
2. The panel says no affected work was found. Click **Try it with a demo company**, then **Create demo company**.
3. It creates five Jira projects (keys starting with `EC`), two Confluence spaces, and the page *"RFC: Retire Payments API v1 on March 31"*. Nothing that already exists is changed. If a project name is taken, the demo one is called, for example, "Platform (demo)".
4. Wait a minute or two for search indexing, then click **Open the demo decision** and click **Empty Chair** on that page.

You see four teams as empty chairs and Platform (your own team, because its issues are assigned to you) at the table. The write scopes in the app are used only for this demo setup and for posting the invitation comment.

### Try it on your own content

1. Make sure a few open Jira issues mention a system, product, or process by name, for example "Payments API v1".
2. Create a Confluence page that proposes a change to that thing, for example *"RFC: Retire Payments API v1 on March 31"*.
3. Open the page and click **Empty Chair** in the byline under the title. The first analysis takes a few seconds.
4. Expand a team to see the evidence and who to ask. Click **Draft invitations** to see invitations and nudges. **Review and post** adds one comment to the page.
5. To see a team **listening**: sign in as a user whose Jira issues are part of the result, open the page without commenting, wait a few minutes, then click **Checked … ago** in the panel to re-check.

Search indexing in Jira and Confluence can take a few minutes after you create issues or pages. If the panel says no affected work was found, wait and click **Check again**.

### Demo data with people (optional)

`scripts/seed.mjs` creates the fictional company used in the demo video: projects Platform, Team Atlas, Customer Support, Finance Ops, and Security, the RFC page, and two Finance pages. It needs Node.js and an Atlassian API token in a local `.env` file:

```
ATLASSIAN_SITE=your-site.atlassian.net
ATLASSIAN_EMAIL=you@example.com
ATLASSIAN_API_TOKEN=your-api-token
```

```
node --env-file=.env scripts/seed.mjs
```

Issues are assigned to Mira Okafor, Priya Raman, and Tom Lindqvist if users with those names exist on the site.

## Development

```
npm install
npm --prefix static/panel install
npm run deploy
```

The panel can be previewed outside Atlassian with demo data: `npm --prefix static/panel run dev`.

Teamwork Graph queries must be registered for the app before they can run. The Cypher for both queries is in `scripts/register-graph-queries.mjs`; their keys are in `src/graph-queries.json`.
