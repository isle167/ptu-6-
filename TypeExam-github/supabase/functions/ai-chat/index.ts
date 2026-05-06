import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    const geminiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: "당신은 TypeExam의 AI 학습 도우미입니다. 정보처리기사 실기, TOEIC, SQL, 알고리즘, 네트워크, 보안, 소프트웨어공학 관련 질문에 친절하고 명확하게 답변해주세요. 답변은 한국어로, 핵심만 간결하게 설명해주세요. 코드나 예시가 필요하면 적극적으로 포함해주세요." }]
          },
          contents: geminiMessages,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "응답을 가져오지 못했어요.";

    return new Response(
      JSON.stringify({ content: [{ type: "text", text: replyText }] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
