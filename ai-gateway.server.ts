// Server-only helper to call Lovable AI Gateway (chat completions).
export async function callLovableAI(body: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  response_format?: { type: "json_object" };
  temperature?: number;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`AI gateway error ${res.status}:`, text);
    if (res.status === 429) throw new Error("تجاوزت حد الاستخدام، حاول لاحقاً");
    if (res.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي");
    throw new Error("تعذّر إكمال الطلب، حاول لاحقاً");
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices[0]?.message?.content ?? "";
}
