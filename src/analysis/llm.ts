import { chat, list } from '@forge/llm';

let cachedModel: string | null = null;

async function model(): Promise<string> {
  if (cachedModel) return cachedModel;
  const { models } = await list();
  const active = models.filter((m) => m.status === 'active').map((m) => m.model);
  cachedModel = active.find((m) => m.includes('sonnet')) ?? active[0];
  if (!cachedModel) throw new Error('No Forge LLM model is available.');
  return cachedModel;
}

/** Sends one system and one user message and returns the text of the first choice. */
export async function ask(system: string, user: string, maxTokens = 1200): Promise<string> {
  const response = await chat({
    model: await model(),
    temperature: 0.2,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: [{ type: 'text', text: system }] },
      { role: 'user', content: [{ type: 'text', text: user }] },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (typeof content === 'string') return content;
  return (content ?? []).map((part) => part.text).join('');
}

/** Like ask, but parses the first JSON object in the reply. */
export async function askJson<T>(system: string, user: string, maxTokens = 1200): Promise<T> {
  const text = await ask(`${system}\nReply with one JSON object and nothing else.`, user, maxTokens);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The model did not return JSON.');
  return JSON.parse(text.slice(start, end + 1)) as T;
}
