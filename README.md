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
| `rovo:agent` and `action` modules | "Who is missing from this decision?", "Draft an invite for this team", and "Which open decisions have empty chairs?" |
| `rovo:mcp` module | The same three tools for external MCP clients such as Claude |
| Forge KVS | Caching analyses per page version, and the list of checked decisions |

All reads run as the current user, so Empty Chair only shows what that user can already see. The app runs entirely on Atlassian: no external services.

## Testing instructions for judges

### Install

1. Open the installation link from the submission.
2. Install into **both Confluence and Jira** on the same site. Jira Service Management is optional but recommended.
3. Installing apps with Teamwork Graph scopes requires **organization admin** permissions on the site.
4. The first time you open the panel, Atlassian asks you to **Allow access** once, because Empty Chair reads as you. If you are signed in to several Atlassian accounts in the same browser, check that the consent page shows the account you use on the site; otherwise the request keeps coming back.

### Fastest way: the demo company

1. Open any Confluence page and click **Empty Chair** in the byline under the title.
2. The panel says no affected work was found. Click **Try it with a demo company**, then **Create demo company**.
3. It creates a Confluence space for each of four teams (Team Atlas, Customer Support, Finance Ops, Security; keys starting with `EC`) with pages that depend on Payments API v1, and the page *"RFC: Retire Payments API v1 on March 31"* in an Engineering space. Nothing that already exists is changed.
4. Wait a minute or two for search indexing, then click **Open the demo decision** and click **Empty Chair** on that page.

You see four teams as empty chairs. The demo uses Confluence only, because creating Jira projects needs a scope that users cannot grant to an app. **The full version does more than the demo can show on a fresh site:** teams come from Jira projects, Jira Service Management queues, and Atlassian teams in the Teamwork Graph; a team is **seated** when one of its people comments on the page, and **listening** when the Teamwork Graph shows that one of them read it without commenting. Both need other people on the site, so a one-person demo cannot produce them.

To see all three states at once, click **See a sample analysis** on any page where Empty Chair found nothing. It is labelled as a sample, uses fictional data, and posts nothing. The demo video shows the same states on real data.

The write scopes in the app are used only for this demo setup and for posting the invitation comment.

### Rovo agent and MCP

- In Rovo Chat, pick the **Empty Chair** agent (or @mention it) and ask *"Who is missing from this decision?"* with a page link, or *"Which open decisions have empty chairs?"*.
- For MCP clients, an org admin turns on **Expose tools to MCP-compatible apps** under admin.atlassian.com → Apps → Sites → your site → Connected apps → Empty Chair → App details. The tools are `find-missing-stakeholders`, `draft-stakeholder-invite`, and `list-open-decisions`.

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
