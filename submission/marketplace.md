# Marketplace listing draft (Best Marketplace published app)

The bonus needs a published listing or a review ticket link. Review takes time, so submit early.

Steps you do yourself:
1. Create a Marketplace partner (vendor) profile at marketplace.atlassian.com/manage (free).
2. Add a privacy policy URL and a support contact. A GitHub page or a public Confluence page is enough.
3. In the developer console, under Distribution, make sure sharing is on, then choose "List on Marketplace" for Empty Chair.
4. Fill in the fields below, upload the logo and 3 to 5 screenshots, and submit for review. Copy the review ticket link into Devpost.

## Name
Empty Chair

## Tagline (short)
See who is affected by a decision, but not at the table.

## Summary
Empty Chair checks every Confluence decision page against the work it affects in Jira, Jira Service Management, and Confluence. It shows which teams are taking part, which are only reading, and which haven't joined, and drafts invitations for the missing ones.

## Highlights
1. **See the empty chairs.** A round table on each decision page shows teams that are seated, listening, or missing, with the Jira issues, service requests, and pages that prove each team is affected.
2. **Invite the right people.** Draft a specific invitation for each missing team and a short nudge for teams that read but stayed quiet. Edit them, then post one comment that mentions the right people.
3. **Ask Rovo or any MCP client.** "Who is missing from this decision?" works in Rovo Chat and from MCP clients such as Claude.

## Data and security
- Runs on Atlassian. No external services.
- Every request runs as the current user, so people only see what they already have access to.
- Stores analysis results in Forge storage for caching. Nothing is posted without the user's confirmation.

## Screenshots to take
1. The round table on the RFC page (hero shot).
2. Team Atlas expanded: evidence and "Who to ask".
3. The invitation sheet with one invite and one nudge.
4. The posted page comment with mentions.
5. Rovo Chat answering "Who is missing from this decision?".
