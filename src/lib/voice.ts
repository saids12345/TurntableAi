// src/lib/voice.ts
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function buildStyleGuide(samples: string[]): Promise<string> {
  const prompt = `
You are a brand-voice analyst. Given example captions/replies, write a concise style guide.

Return sections:
- Tone (3-5 bullets)
- Vocabulary & Phrases (5-10 bullets)
- Formatting & Emojis (2-4 bullets)
- Do (3-5 bullets)
- Don't (3-5 bullets)
- 2 Sample Lines in this voice

Examples:
${samples.map((s, i) => `(${i + 1}) ${s}`).join("\n")}
  `.trim();

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });
  return res.choices[0]?.message?.content?.trim() || "";
}

export async function averageEmbedding(texts: string[]): Promise<number[] | null> {
  if (!texts.length) return null;
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  const vecs = res.data.map(d => d.embedding);
  const dims = vecs[0].length;
  const sum = new Array(dims).fill(0);
  for (const v of vecs) for (let i = 0; i < dims; i++) sum[i] += v[i];
  return sum.map(x => x / vecs.length);
}
