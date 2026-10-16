import { NextResponse } from "next/server";

type TonicRequest = {
  reflections: Array<{
    topic: string;
    subtopic?: string;
    orientation?: string;
  }>;
  habits?: Array<{
    title: string;
    group?: string;
  }>;
  recentEntries?: Array<{
    topic: string;
    excerpt: string;
  }>;
};

export async function POST(request: Request) {
  const provider = process.env.AI_PROVIDER ?? "openai";
  const body = (await request.json()) as TonicRequest;

  if (provider === "gemini") {
    return generateWithGemini(body);
  }

  return generateWithOpenAI(body);
}

async function generateWithOpenAI(body: TonicRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not configured.",
        fallback:
          "Hoje procure transformar observação em ação: escolha uma atitude pequena, concreta e fiel ao caminho."
      },
      { status: 503 }
    );
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
            "Você sintetiza reflexões discipulares em português do Brasil. Seja profundo, prático, jovem e sóbrio. Não dê conselhos deterministas; gere direcionamento e perguntas."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Gerar Tônica do Dia com título curto, síntese, orientação prática e 3 perguntas de aprofundamento.",
            reflections: body.reflections,
            habits: body.habits ?? [],
            recentEntries: body.recentEntries ?? []
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "daily_tonic",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              synthesis: { type: "string" },
              practicalDirection: { type: "string" },
              questions: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3
              }
            },
            required: ["title", "synthesis", "practicalDirection", "questions"]
          }
        }
      }
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

  if (!text) {
    return NextResponse.json({ error: "OpenAI response did not include text." }, { status: 502 });
  }

  try {
    return NextResponse.json({ tonic: JSON.parse(text) });
  } catch {
    return NextResponse.json({ error: "OpenAI response was not valid JSON." }, { status: 502 });
  }
}

async function generateWithGemini(body: TonicRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "GEMINI_API_KEY is not configured.",
        fallback:
          "A integração com o Gemini está preparada e será ativada assim que a chave segura for cadastrada."
      },
      { status: 503 }
    );
  }

  const prompt = JSON.stringify({
    task: "Gerar Tônica do Dia em JSON puro com title, synthesis, practicalDirection e questions com 3 strings.",
    style: "portugues do Brasil, profundo, pratico, jovem, sobrio, sem conselhos deterministas",
    reflections: body.reflections,
    habits: body.habits ?? [],
    recentEntries: body.recentEntries ?? []
  });

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
              "Voce sintetiza reflexoes discipulares. Responda somente JSON valido, sem markdown."
          }
        ]
      },
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Gemini request failed." }, { status: response.status });
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return NextResponse.json({ error: "Gemini response did not include text." }, { status: 502 });
  }

  try {
    return NextResponse.json({ tonic: JSON.parse(text) });
  } catch {
    return NextResponse.json({ error: "Gemini response was not valid JSON." }, { status: 502 });
  }
}
