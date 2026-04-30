import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { spawn } from "child_process";
import { chatHandler } from "./src/routes/chat.js";
import { askHandler } from "./src/routes/ask.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Bypasses the localtunnel splash screen for Vapi
app.use((req, res, next) => {
  res.setHeader('bypass-tunnel-reminder', 'true');
  next();
});

const PORT = 3000;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

// Load vector store
const vectorStorePath = path.join(process.cwd(), "data", "vector_store.json");
let vectorStore = [];

function loadVectorStore() {
  try {
    if (fs.existsSync(vectorStorePath)) {
      vectorStore = JSON.parse(fs.readFileSync(vectorStorePath, "utf-8"));
      const blogTitles = [...new Set(vectorStore.map(c => c.title))];
      console.log(`✅ Loaded ${vectorStore.length} chunks from vector_store.json`);
      console.log(`   Blogs: ${blogTitles.join(', ')}`);
    } else {
      console.warn("⚠️  vector_store.json not found! Run: npm run ingest");
    }
  } catch (e) {
    console.error("❌ Failed to load vector store", e);
  }
}

// Initial load
loadVectorStore();

// Watch for changes
fs.watch(vectorStorePath, { persistent: false }, (eventType) => {
  if (eventType === 'change') {
    console.log("\n🔄 vector_store.json changed — reloading...");
    loadVectorStore();
  }
});

// Routes
app.post("/chat", (req, res) => chatHandler(req, res, vectorStore));
app.post("/ask-blog", (req, res) => askHandler(req, res, vectorStore));

// Auto-updates the Vapi assistant with the new tunnel URL
async function updateVapiAssistantWebhook(tunnelUrl) {
  if (!VAPI_ASSISTANT_ID) {
    console.warn("⚠️  VAPI_ASSISTANT_ID not set in .env — skipping auto-update.");
    return;
  }

  const webhookUrl = `${tunnelUrl}/ask-blog`;
  console.log(`🔄 Auto-updating Vapi assistant webhook to: ${webhookUrl}`);

  try {
    const res = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${VAPI_PRIVATE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: {
          tools: [
            {
              type: "function",
              function: {
                name: "ask_blog",
                description: "Answer questions from the blog content. Call this whenever the user asks about a topic.",
                parameters: {
                  type: "object",
                  properties: {
                    question: { type: "string", description: "The user's question to search the blog for." }
                  },
                  required: ["question"]
                }
              },
              server: { url: webhookUrl }
            }
          ]
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("❌ Failed to update Vapi assistant:", err);
    } else {
      console.log("✅ Vapi assistant webhook updated successfully!");
    }
  } catch (e) {
    console.error("❌ Error calling Vapi API:", e.message);
  }
}

// Starts a Cloudflare Quick Tunnel
function startCloudflaredTunnel(port) {
  return new Promise((resolve, reject) => {
    console.log("\n🔌 Starting Cloudflare Quick Tunnel...");
    const proc = spawn("npx", ["cloudflared", "tunnel", "--url", `http://localhost:${port}`], {
      shell: true
    });

    let resolved = false;
    const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

    const handleOutput = (data) => {
      const text = data.toString();
      process.stdout.write(text);
      const match = text.match(urlPattern);
      if (match && !resolved) {
        resolved = true;
        resolve({ url: match[0], process: proc });
      }
    };

    proc.stdout.on("data", handleOutput);
    proc.stderr.on("data", handleOutput);

    setTimeout(() => {
      if (!resolved) reject(new Error("Timed out waiting for cloudflared URL"));
    }, 90000);
  });
}

app.listen(PORT, async () => {
  console.log(`\nServer running locally on http://localhost:${PORT}`);
  try {
    const { url, process: cfProcess } = await startCloudflaredTunnel(PORT);
    console.log(`\n🌐 PUBLIC TUNNEL URL: ${url}\n`);
    await updateVapiAssistantWebhook(url);
    cfProcess.on("close", () => console.log("⚠️  Cloudflare tunnel closed."));
  } catch (e) {
    console.error("❌ Could not start Cloudflare tunnel:", e.message);
  }
});
