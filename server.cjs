var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.post("/api/analyze", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
        return res.status(200).json({
          error: "GEMINI_API_KEY is not configured or placeholder. Falling back to local plan generation.",
          fallback: true
        });
      }
      const { profile, feeling, tasks } = req.body;
      const ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const todayTodoString = JSON.stringify(
        tasks.filter((t) => t.deadlineType === "today" && t.status === "todo").map((t) => ({ id: t.id, title: t.title, priority: t.priority, urgent: t.urgent, duration: t.duration }))
      );
      const weekTodoString = JSON.stringify(
        tasks.filter((t) => t.deadlineType === "week" && t.status === "todo").map((t) => ({ id: t.id, title: t.title, priority: t.priority, duration: t.duration }))
      );
      const completedCountString = tasks.filter((t) => t.status === "done").length;
      const systemPrompt = `You are Mindful Flow AI, an elegant, empathetic productivity planner. 
Your goal is to suggest a customized daily plan based on the user's focus capacity, energy constraints, and anticipated distraction parameters.
Do not recommend unrealistic plans. Prioritize tasks and build realistic schedule blocks.

CRITICAL: All user-facing text property values in the returned JSON (specifically inside "motivationTips", "warnings", "explanation", and the "activity" of schedule blocks unless referencing a specific task title) MUST be generated entirely in the Persian (Farsi) language. Use a supportive, poetic, professional, and elegant Persian tone.

User Day Frame: Morning is initial 1/3 of workday, Midday is middle 1/3, Night is final 1/3.
Workday Starts at: ${feeling.workdayStart} (24-hour style).
User reported today's overall energy as: "${feeling.overallMood}".
Cognitive Capacity reported: ${feeling.capacityHours} hours.
Anticipated Distractions: ${JSON.stringify(feeling.distractions)}.

Output schema matches a structured JSON object.
Return:
1. prioritizedTaskIds: list of up to 2 task IDs which are absolute anchors for today.
2. suggestedOrder: ordered list of today's task IDs sequentially.
3. motivationTips: List of 2 or 3 calm, highly motivating tips for this specific mindset (in Persian).
4. warnings: List of load indicators (e.g., if total task duration exceeds cognitive capacity or energy is too low) (in Persian).
5. scheduleBlocks: Sequential blocks of time starting at the workday start, defining focus sessions for today's tasks and necessary breaks/personal restorative cycles (such as break, buffer, focus, personal) (activity labels in Persian).
6. explanation: Direct friendly justification on why this plan respects their current energy and capacity levels (in Persian).`;
      const promptPayLoad = `
Analyze the following tasks:
- Active Today Todo Tasks: ${todayTodoString}
- Active This Week Todo Tasks: ${weekTodoString}
- Standard User Daily Limit: ${profile.dailyCapacity} hrs
- Today's State: Capacity ${feeling.capacityHours} hrs, mood: "${feeling.overallMood}"
- Already Completed Today: ${completedCountString} tasks

Task prioritization suggestions and workday schedule blocks logic:
Please generate the JSON response conforming to the schema precisely.
`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptPayLoad,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              prioritizedTaskIds: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "Array of task IDs suggested for absolute prioritization"
              },
              suggestedOrder: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "Array of all task IDs sorted in optimal execution order"
              },
              motivationTips: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "Calm, specific advice fitting user mood"
              },
              warnings: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "Load warnings or pacing considerations"
              },
              scheduleBlocks: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    time: { type: import_genai.Type.STRING, description: "e.g. '09:00 - 10:30'" },
                    taskId: { type: import_genai.Type.STRING, description: "linked task id if applicable" },
                    activity: { type: import_genai.Type.STRING, description: "Name of scheduled task or rest action" },
                    type: { type: import_genai.Type.STRING, description: "Must be focus, buffer, break, or personal" }
                  },
                  required: ["time", "activity", "type"]
                }
              },
              explanation: {
                type: import_genai.Type.STRING,
                description: "Empathetic paragraph explanation detailing why this custom agenda suits them"
              }
            },
            required: ["prioritizedTaskIds", "suggestedOrder", "motivationTips", "warnings", "scheduleBlocks", "explanation"]
          }
        }
      });
      const responseText = response.text || "{}";
      const planData = JSON.parse(responseText.trim());
      res.json(planData);
    } catch (err) {
      console.error("Gemini server-side planner error:", err);
      res.status(200).json({
        error: "Internal failure generating AI plan",
        message: err.message,
        fallback: true
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Mindful Flow Server] running on http://localhost:${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
