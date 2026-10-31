/** Removes the formatting models tend to add to text that is shown and posted as plain prose. */
export function cleanInvite(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\s*\**\s*subject\s*:/i.test(line))
    .filter((line) => !/^\s*\**\s*(link|see the full rfc|rfc)\s*:/i.test(line))
    .join('\n')
    .replace(/\*\*|__/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
