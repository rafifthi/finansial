import "server-only";

/**
 * The app's LLM: DeepSeek (or Kimi), both OpenAI-compatible Chat Completions
 * with base64 images. DeepSeek is used when its key is set, else Kimi;
 * VISION_PROVIDER picks explicitly. Plain fetch, no SDK.
 */
const PROVIDERS = {
  deepseek: {
    key: "DEEPSEEK_API_KEY",
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-flash",
    extra: {},
  },
  kimi: {
    key: "MOONSHOT_API_KEY",
    url: "https://api.moonshot.ai/v1/chat/completions",
    model: "kimi-k2.6",
    // Reading receipts and short notes doesn't need reasoning; it only slows the reply.
    extra: { thinking: { type: "disabled" } },
  },
} as const;

type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS];

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export interface AiImage {
  media_type: (typeof IMAGE_TYPES)[number];
  /** Base64, no data: prefix. */
  data: string;
}

function pickProvider(): Provider | null {
  const wanted = process.env.VISION_PROVIDER as keyof typeof PROVIDERS | undefined;
  if (wanted && wanted in PROVIDERS) return process.env[PROVIDERS[wanted].key] ? PROVIDERS[wanted] : null;
  return (Object.values(PROVIDERS) as Provider[]).find((p) => process.env[p.key]) ?? null;
}

/** Pulls the JSON object out of a reply that may be wrapped in a code fence or prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * One request, one JSON reply. `prompt` must ask for JSON. Throws errors
 * worded for the user.
 */
export async function completeJson({
  system,
  prompt,
  images = [],
  maxTokens = 8000,
}: {
  system?: string;
  prompt: string;
  images?: AiImage[];
  maxTokens?: number;
}): Promise<unknown> {
  const provider = pickProvider();
  if (!provider) throw new Error("AI isn't set up: add DEEPSEEK_API_KEY (or MOONSHOT_API_KEY) on the server.");

  const userContent = images.length
    ? [
        ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.media_type};base64,${img.data}` } })),
        { type: "text", text: prompt },
      ]
    : prompt;

  let res: Response;
  try {
    res = await fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env[provider.key]}` },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        ...provider.extra,
        messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: userContent }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error("Couldn't reach the AI. Try again in a moment.");
  }

  if (res.status === 401 || res.status === 403) throw new Error(`The server's ${provider.key} was rejected.`);
  if (res.status === 402) throw new Error("The AI account is out of balance. Top it up to keep using AI features.");
  if (res.status === 429) throw new Error("The AI is busy. Try again in a minute.");
  if (!res.ok) {
    console.error("[ai]", provider.model, res.status, (await res.text()).slice(0, 500));
    throw new Error(`The AI request failed (${res.status}). Try again.`);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const choice = body.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("That was too much at once. Send less per message.");
  try {
    return extractJson(choice?.message?.content ?? "");
  } catch {
    console.error("[ai] unreadable reply", (choice?.message?.content ?? "").slice(0, 500));
    throw new Error("The AI's answer couldn't be read. Try again or rephrase.");
  }
}
