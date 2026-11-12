# Empty Chair: demo video script (target 4:30, hard limit 5:00)

Record on philippschaefer.atlassian.net with the seeded company (Platform, Team Atlas, Customer Support, Finance Ops, Security) and the page "RFC: Retire Payments API v1 on March 31" (page id 983041). Use only numbers the app shows on screen. No invented statistics.

Before recording:
- Mira has opened the RFC page in the last days without commenting, so Team Atlas shows as "Read it, not speaking".
- Delete earlier Empty Chair comments on the RFC page so the posting step is fresh.
- Click "Checked … ago" once so the analysis is current.
- Claude (desktop or claude.ai) is connected to the Empty Chair MCP server.
- Rovo works on the provisioned demo site (forge site provision); record that part there.

## 0:00 to 0:20: the problem

Screen: the RFC page, scrolled slowly.

> Platform wants to retire Payments API v1 on March 31. The RFC is written, two engineers have commented, it looks ready.
> But Finance Ops exports every invoice through that API. They aren't on this page. They'll find out on March 30.
> Every decision has people it affects who were never in the room. Empty Chair shows you who.

## 0:20 to 1:30: the round table

Screen: click "Empty Chair" in the byline. Let the loading steps play.

> Empty Chair reads the decision, works out what it changes, here Payments API v1, and follows that through Jira, Jira Service Management and Confluence.

Screen: the round table appears. Hover the empty chairs.

> Five teams are affected. Platform is at the table. Team Atlas read the page but hasn't said anything. Customer Support, Finance Ops and Security haven't joined at all.

Screen: point at the line "Who read the page comes from the Teamwork Graph".

> "Read it, not speaking" comes from the Teamwork Graph. The team names come from Atlassian teams in the graph too, not from guesses.

## 1:30 to 2:20: the evidence

Screen: expand Team Atlas. Show the ATL issues and "Who to ask: Mira Okafor".

> Every chair has evidence. Team Atlas has open issues built on Payments API v1, and Empty Chair names the person to ask.

Screen: expand Customer Support: customer requests. Expand Finance Ops: the runbook page.

> Support has customer requests about it. Finance has a runbook that depends on the export endpoint.
> The author's own tickets don't count as a team being involved, and if the graph can't answer, the app says so instead of claiming nobody read it.

## 2:20 to 3:20: invite, then post

Screen: click "Draft invitations". Show one INVITE and the NUDGE for Team Atlas.

> One click drafts a specific invitation for each missing team, and a short nudge for the team that's listening. They're written from the evidence, and you can edit them.

Screen: edit one word, click "Review and post". Show the page comment with the @mentions.

> Nothing is sent until you confirm. Then it's one comment on the page that mentions the right people.

## 3:20 to 4:00: Rovo and MCP

Screen (demo site): Rovo Chat, pick the Empty Chair agent, ask "Who is missing from this decision?" with the page link. Then "Which open decisions have empty chairs?".

> The same check works in Rovo. Ask the agent who's missing, or which open decisions still have empty chairs.

Screen: Claude with the MCP connector, ask it to check the page. Show the find-missing-stakeholders tool call and its answer.

> And because Empty Chair is an Atlassian MCP server, any MCP client can use it. Here Claude calls the same tool.

## 4:00 to 4:30: how it's built

Screen: README table of platform features, or a simple slide.

> It's a Forge app that runs entirely on Atlassian: a Confluence byline panel, Forge LLMs, the Teamwork Graph with persisted queries, Jira and Confluence APIs, a Rovo agent, and an MCP server. Everything runs as the current user, so it only shows what you can already see.
> Empty Chair. Before you decide, check who isn't at the table.
