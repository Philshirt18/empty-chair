# Marketplace listing (Best Marketplace published app)

The bonus prize accepts a published listing **or** a review ticket link. Review takes about 1 to 2 weeks, so submit early.

Once the app is listed, it can no longer be shared through the developer console link; it is then installed from the Marketplace. Until approval, the console link keeps working for judges.

## Before you start

| What | Status |
|---|---|
| Sharing on in the developer console (Distribution) | do this first |
| Privacy policy at a public URL | text in `PRIVACY.md`; replace SUPPORT_EMAIL, then publish it |
| Logo 144x144 | `submission/assets/logo-144.png` |
| Banner 1120x548 | `submission/assets/banner-1120x548.png` |
| 3 highlight screenshots, 1840x900 | take them (see below) |

## Steps

1. Go to marketplace.atlassian.com and sign in. In the profile menu (upper right), choose **Manage vendor account** (sometimes labelled **Manage partner account**). Create the partner profile:
   - name: Philipp Schaefer
   - logo: `logo-144.png`
   - then click **Create vendor**
2. Open marketplace.atlassian.com/manage/apps/create. Choose the Forge app **Empty Chair**, pricing **Free**, and fill in the fields below. Accept the Marketplace Partner Agreement and submit.
3. In the partner portal, select the app and open **Privacy and Security**. Only the privacy policy link is required. The answers below are recommended. Click **Save and preview**, then **Submit and publish**.
4. Submit the app for review. Turn on notifications so you see reviewer questions.
5. Copy the review ticket link (or the listing URL once approved) into Devpost.

## Listing fields

**App name** (60 max; must not contain "app", "plugin", "Atlassian"):
Empty Chair

**Tagline** (130 max):
See which teams a decision affects, and which of them are not part of it yet.

**Summary** (250 max):
Empty Chair checks Confluence decisions against the work they affect in Jira, Jira Service Management, and Confluence. It shows which teams are taking part, which only read, and which haven't joined, and drafts invitations.

**More details** (1000 max):
Decisions go wrong when the people they affect find out too late. Empty Chair adds a round table to every Confluence proposal, RFC, and decision record. It reads what the decision changes, finds the Jira issues, service requests, and pages that depend on it, and groups them by team.

Teams that commented are seated. Teams where someone read the page, according to the Teamwork Graph, but nobody spoke are listening. Teams that haven't joined are empty chairs. Each team comes with evidence and the people to ask.

One click drafts a specific invitation for each missing team and a short nudge for each quiet one. You review them, and Empty Chair posts one page comment that mentions the right people.

The same check works in Rovo Chat through the Empty Chair agent, and in MCP clients such as Claude.

Runs on Atlassian. Every request runs as the current user, so people only see what they can already access.

**Highlights** (3 required; title 50 max, summary 220 max, caption 220 max):

1. Title: See the empty chairs
   Summary: A round table on every decision page shows which affected teams are seated, listening, or missing, with the Jira issues, service requests, and pages that show why each team is affected.
   Screenshot: the round table on the RFC page.
2. Title: Know who to ask
   Summary: Expand a team to see the work that depends on the decision and the people doing it. Reading comes from the Teamwork Graph; the author's own tickets never count as a team's involvement.
   Screenshot: Team Atlas expanded with evidence and "Who to ask".
3. Title: Invite them in one comment
   Summary: Draft a specific invitation for each missing team and a short nudge for teams that read but stayed quiet. Edit them, then post one comment that mentions the right people.
   Screenshot: the invitation sheet with an invite and a nudge.

**Release summary** (80 max):
First release: decision check panel, Rovo agent, and MCP tools.

## Privacy and Security answers

- Privacy policy URL: the published `PRIVACY.md`
- Does the app store data outside Atlassian? No (Runs on Atlassian, no egress).
- Does the app process personal data? Yes: names and account IDs of suggested contacts, stored in Forge storage within the customer's site.
- Retention: cached results are deleted after 6 hours, the latest result per page after 30 days, everything on uninstall.
- Third-party sharing: none.
- Data residency: data stays in Forge storage, which follows the site's Atlassian data residency.
- Scope justification: read scopes are used to analyze the page and related Jira and Confluence work; `write:comment:confluence` posts the invitation comment after the user confirms; `write:page:confluence` and `write:space:confluence` are used only by the optional demo setup; Teamwork Graph scopes read who viewed the page and team membership; `storage:app` caches results.

## Screenshots to take (1840x900)

Take them on philippschaefer.atlassian.net, with the browser window at about 1840 px wide and zoomed so the panel fills the frame:

1. the round table on the RFC page (also the Devpost hero image);
2. Team Atlas expanded;
3. the invitation sheet.
