// Supabase Edge Function: learning-coach
// Generates personalized learning roadmaps using Google Gemini API
// Securely verifies caller JWT and never exposes GEMINI_API_KEY to the client

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RoadmapRequest {
  skill: string;
  experience_level: "beginner" | "intermediate" | "advanced";
  learning_goal: string;
  weekly_hours?: number;
  pace?: "relaxed" | "steady" | "intensive";
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify Authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ??
      Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
      Deno.env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate Inputs
    const body: RoadmapRequest = await req.json();
    const { skill, experience_level, learning_goal, weekly_hours = 10, pace = "steady" } = body;

    if (!skill || skill.trim().length === 0 || skill.length > 100) {
      return new Response(
        JSON.stringify({ error: "Skill must be between 1 and 100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!learning_goal || learning_goal.trim().length === 0 || learning_goal.length > 500) {
      return new Response(
        JSON.stringify({ error: "Learning goal must be between 1 and 500 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: "AI service is currently not configured on this server. Please contact support.",
          code: "AI_NOT_CONFIGURED"
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Build Strict Gemini Prompt
    const systemPrompt = `You are the UPMIND AI Learning Coach, an expert educational mentor.
Your job is to generate a comprehensive, highly practical, realistic learning roadmap.
The output MUST be valid JSON strictly adhering to the schema below. Do not wrap in markdown quotes or code fences. Only output raw JSON.

Output JSON Schema:
{
  "skill": "${skill.trim()}",
  "title": "Clear catchy title for this roadmap",
  "summary": "2-3 sentences overview explaining how the learner will progress",
  "total_weeks": number,
  "weekly_hours": ${weekly_hours},
  "pace": "${pace}",
  "experience_level": "${experience_level}",
  "stages": [
    {
      "stage_number": 1,
      "title": "Stage title",
      "duration": "e.g., Weeks 1-2",
      "topics": ["topic 1", "topic 2", "topic 3"],
      "practical_exercises": ["exercise 1 with hands-on output", "exercise 2"],
      "milestones": ["concrete milestone 1"],
      "self_assessment_questions": [
        {
          "question": "Concept check question",
          "hint": "Key hint or explanation"
        }
      ],
      "suggested_next_steps": ["Actionable next step"]
    }
  ],
  "tips_for_success": ["tip 1", "tip 2"]
}`;

    const userPrompt = `Generate a customized learning roadmap for:
- Skill: ${skill}
- Experience Level: ${experience_level}
- Learning Goal: ${learning_goal}
- Available Hours Per Week: ${weekly_hours}
- Pace: ${pace}

Generate 3 to 5 clear progressive stages with practical exercises. Return only the JSON document.`;

    // 4. Call Gemini REST API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error:", response.status, errText);
      return new Response(
        JSON.stringify({
          error: "Failed to generate roadmap from AI provider. Please try again shortly.",
          status: response.status
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await response.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Empty response from AI model");
    }

    // Clean any potential markdown backticks if model included them
    let cleanedJson = rawText.trim();
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedRoadmap = JSON.parse(cleanedJson);

    return new Response(JSON.stringify({ roadmap: parsedRoadmap }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error generating learning roadmap:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
