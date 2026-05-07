import fetch from "node-fetch";
import dotenv from "dotenv";
import { getEmbedding } from "./embedding.js";
import { cosineSimilarity } from "../utils/similarity.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Search the vector store for the most relevant chunks (using Gemini Embeddings)
 */
export async function searchVectorStore(question, vectorStore, topK = 3, blogId = null) {
  const queryEmbedding = await getEmbedding(question);

  const filteredStore = blogId
    ? vectorStore.filter(chunk => String(chunk.blogId) === String(blogId))
    : vectorStore;

  const scoredChunks = filteredStore.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));

  scoredChunks.sort((a, b) => b.score - a.score);

  const SIMILARITY_THRESHOLD = 0.2;
  const relevantChunks = scoredChunks.filter(c => c.score >= SIMILARITY_THRESHOLD);

  console.log(`🔍 RAG Search: Found ${scoredChunks.length} total, ${relevantChunks.length} relevant (threshold ${SIMILARITY_THRESHOLD})`);
  return relevantChunks.slice(0, topK);
}

/**
 * Generate a streaming response using GROQ (Llama 3.3 70B)
 * This is incredibly fast for voice applications.
 */
export async function generateStreamingLLMResponse(question, topChunks, onToken) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set in .env");

  const blogTitle = topChunks[0]?.title || "this blog article";
  const contextText = topChunks.map(c => `[Article: ${c.title}]\n${c.content}`).join("\n\n");
  
  const systemPrompt = `You are an expert AI assistant specialized ONLY in the article: "${blogTitle}".

STRICT RULES:
1. Answer ONLY using the ARTICLE CONTEXT provided below. Never use outside knowledge.
2. Be concise and conversational — keep responses to 1-3 short sentences.
3. Sound natural and human — use phrases like "Well," "Actually," or "Interestingly."
4. Do NOT use markdown, asterisks, or formatting. No bold, no lists.
5. If the answer isn't in the context, say: "I'm sorry, that isn't covered in this article. I can only discuss this specific post."
6. Never say "based on the context." Just talk naturally.

ARTICLE CONTEXT:
${contextText}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0.3,
        max_tokens: 250,
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API Error: ${err}`);
    }

    // Process the stream
    response.body.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(line => line.trim() !== "");
      for (const line of lines) {
        if (line.includes("[DONE]")) return;
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.substring(6));
            const token = data.choices?.[0]?.delta?.content;
            if (token) onToken(token);
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    });

    return new Promise((resolve) => {
      response.body.on("end", resolve);
    });
  } catch (err) {
    console.error("❌ Groq Streaming Error:", err.message);
    throw err;
  }
}

/**
 * Generate a standard response using GROQ
 */
export async function generateLLMResponse(question, topChunks, systemPrompt) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set in .env");

  const contextText = topChunks.map(c => `[Article: ${c.title}]\n${c.content}`).join("\n\n");
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `CONTEXT:\n${contextText}\n\nUser: ${question}` }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
  } catch (err) {
    console.error("❌ Groq API Error:", err.message);
    throw err;
  }
}
