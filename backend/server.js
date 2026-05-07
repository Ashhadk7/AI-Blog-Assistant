import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { spawn } from "child_process";
import { chatHandler } from "./src/routes/chat.js";
import { askHandler } from "./src/routes/ask.js";
import { customLLMHandler } from "./src/routes/customLLM.js";
import { ingestBlogs } from "./src/services/ingestion.js";
import { blogs } from "./data/blogs.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("bypass-tunnel-reminder", "true");
  next();
});

const PORT = 3000;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
let publicUrl = "";

const vectorStorePath = path.join(process.cwd(), "data", "vector_store.json");
let vectorStore = [];

function loadVectorStore() {
  try {
    if (fs.existsSync(vectorStorePath)) {
      vectorStore = JSON.parse(fs.readFileSync(vectorStorePath, "utf-8"));
      console.log(`✅ Loaded ${vectorStore.length} chunks from vector_store.json`);
    }
  } catch (e) {
    console.error("❌ Failed to load vector store:", e.message);
  }
}

loadVectorStore();

app.get("/api/config", (req, res) => res.json({ publicUrl }));
app.post("/api/log", (req, res) => {
  console.log("❌ FRONTEND:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});
app.get("/api/blogs", (req, res) => res.json(blogs));
app.post("/chat", (req, res) => chatHandler(req, res, vectorStore));
app.post("/ask-blog", (req, res) => askHandler(req, res, vectorStore));
app.post("/v1/chat/completions", (req, res) => customLLMHandler(req, res, vectorStore));

async function updateVapiAssistant(tunnelUrl) {
  if (!VAPI_PRIVATE_KEY || !VAPI_ASSISTANT_ID) return;
  try {
    const llmUrl = `${tunnelUrl}/v1/chat/completions`;
    console.log(`🔧 Configuring Vapi — LLM URL: ${llmUrl}`);

    const res = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${VAPI_PRIVATE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: {
          provider: "custom-llm",
          url: llmUrl,
          model: "gpt-3.5-turbo"
        },
        silenceTimeoutSeconds: 60,
        firstMessage: "Hello! I'm your AI Blog Expert. Ask me anything about this article!"
      })
    });

    if (res.ok) {
      console.log("✅ Vapi assistant configured successfully!");
    } else {
      const err = await res.json();
      console.error("❌ Vapi update failed:", JSON.stringify(err, null, 2));
    }
  } catch (e) {
    console.error("❌ Error updating Vapi:", e.message);
  }
}

function startCloudflaredTunnel(port) {
  return new Promise((resolve, reject) => {
    console.log("\n🔌 Starting Cloudflare Tunnel...");
    const proc = spawn("npx", ["cloudflared", "tunnel", "--url", `http://127.0.0.1:${port}`], { shell: true });
    let resolved = false;
    const handleOutput = (data) => {
      const text = data.toString();
      // process.stdout.write(text); // Removed verbose tunnel logs
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        resolve({ url: match[0], process: proc });
      }
    };
    proc.stdout.on("data", handleOutput);
    proc.stderr.on("data", handleOutput);
  });
}

app.listen(PORT, async () => {
  console.log(`\nServer running on http://localhost:${PORT}`);
  try {
    const { url, process: cfProcess } = await startCloudflaredTunnel(PORT);
    publicUrl = url;
    console.log(`\n🌐 PUBLIC URL: ${url}\n`);
    await updateVapiAssistant(url);
  } catch (e) {
    console.error("❌ Tunnel failed:", e.message);
  }
});
