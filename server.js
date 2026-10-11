
require("dotenv").config();

const express = require("express");
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3000;
const MODEL = "gemini-3.8-flash";

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env file");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(express.static(__dirname));
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Please upload an image."));
    }
  },
});

// PLANT IDENTIFICATION
app.post("/api/identify", upload.single("plantImage"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a plant image.",
      });
    }

    const prompt = `
You are Garuna, a careful botanical identification assistant.
Analyze this image and answer using clear headings and concise bullet points.

Include:
- Possible common name
- Scientific name, if identifiable
- Confidence: High, Medium, or Low
- Visible identifying features
- Typical habitat
- Traditional uses, only when reasonably established

Do not invent facts. State uncertainty when necessary.
Traditional uses do not prove safety or effectiveness.
Never recommend consuming unknown plants or replacing medical care.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: req.file.mimetype,
          },
        },
        { text: prompt },
      ],
    });

    res.json({
      result: result.text || "No identification returned.",
    });
  } catch (error) {
    console.error("Identification error:", error.message);
    res.status(500).json({
      error: "Plant identification failed. Please try again.",
    });
  }
});

// GARUNA CHATBOT
app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a question.",
      });
    }

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: `
You are Garuna, a precise botanical knowledge assistant.

USER QUESTION:
${message.trim().slice(0, 2000)}

RULES:
- Answer the exact question immediately.
- Never start with "Hi, I am Garuna" or a generic introduction.
- Use simple, clear English.
- Usually keep the answer between 50 and 120 words.
- Use short headings and bullet points when helpful.
- Give scientific names when known.
- Do not invent facts; explain uncertainty.
- Distinguish traditional uses from proven scientific evidence.
- Never recommend consuming unknown plants or using plants instead
  of professional medical care.
- If greeted, respond with one short friendly sentence.
- Avoid irrelevant introductions and conclusions.

Return only the answer.
`,
    });

    res.json({
      reply: result.text || "No answer was returned. Please try again.",
    });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(500).json({
      error: "Garuna couldn't answer right now. Please try again.",
    });
  }
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Garuna is running at http://localhost:${PORT}`);
});
