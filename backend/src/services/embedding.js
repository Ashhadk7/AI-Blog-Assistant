import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_TIMEOUT_MS = 5000; // 5 second timeout — prevents Vapi hang

/**
 * Get semantic embedding using Gemini Embedding API.
 * Includes an AbortController timeout so Vapi is never left waiting.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function getEmbedding(text) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-2",
          content: { parts: [{ text }] }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Embedding HTTP ${response.status}: ${err}`);
    }

    const data = await response.json();

    if (!data.embedding?.values) {
      throw new Error("Gemini Embedding returned no values");
    }

    return data.embedding.values;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`Gemini Embedding timed out after ${EMBEDDING_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}
