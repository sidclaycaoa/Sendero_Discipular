import { NextResponse } from "next/server";

type InsightRequest = {
  kind: "reflection" | "diary";
  title: string;
  currentPrompt?: string;
  history: Array<{
    date?: string;
    topic?: string;
    excerpt: string;
  }>;
  periods?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as InsightRequest;
  const provider = process.env.AI_PROVIDER ?? "openai";

  if (provider === "gemini") {
    return generateWithGemini(body);
  }

  return generateWithOpenAI(body);
}

function buildPrompt(body: InsightRequest) {
  if (body.kind === "diary") {
    return JSON.stringify({
      task: "Gerar leitura do diario em JSON puro.",
      expectedShape: {
        title: "string",
        synthesis: "string",
        growthSignals: ["string"],
        stagnationSignals: ["string"],
        questions: ["string"]
      },
      periods: body.periods ?? ["semana", "quinzena", "mes"],
      history: body.history
    });
  }

  return JSON.stringify({
    task: "Gerar insight de uma reflexão específica em JSON puro.",
    expectedShape: {
      title: "string",
      synthesis: "string",
      recurringPatterns: ["string"],
      questions: ["string"]
    },
    reflection: {
      title: body.title,
      currentPrompt: body.currentPrompt
    },
    history: body.history
  });
}

async function generateWithOpenAI(body: InsightRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.5",
      input: [
        {
          role: "system",
          content:
            "Você é um leitor discipular. Seja sóbrio, prático e profundo. Não dê comandos deterministas; mostre padrões, perguntas e possibilidades."
        },
        { role: "user", content: buildPrompt(body) }
      ]
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "OpenAI request failed." }, { status: response.status });
  }

  const data = await response.json();
  const text =
    data.output_text ??
    data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
      ?.map((content: { text?: string }) => content.text)
      ?.filter(Boolean)
      ?.join("\n");

  return parseInsight(text, "OpenAI");
}

async function generateWithGemini(body: InsightRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [
          {
            text:
              "Voce e um leitor discipular. Responda somente JSON valido, sem markdown. Seja sobrio, pratico e profundo."
          }
        ]
      },
      contents: [{ parts: [{ text: buildPrompt(body) }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Gemini request failed." }, { status: response.status });
  }

  const data = await response.json();
  return parseInsight(data.candidates?.[0]?.content?.parts?.[0]?.text, "Gemini");
}

function parseInsight(text: string | undefined, provider: string) {
  if (!text) {
    return NextResponse.json({ error: `${provider} response did not include text.` }, { status: 502 });
  }

  try {
    return NextResponse.json({ insight: JSON.parse(text) });
  } catch {
    return NextResponse.json({ error: `${provider} response was not valid JSON.` }, { status: 502 });
  }
}
