import fetch from "node-fetch";
import dotenv from "dotenv";
import { getEmbedding } from "./embedding.js";
import { cosineSimilarity } from "../utils/similarity.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Search the vector store for the most relevant chunks
 * @param {string} question 
 * @param {Array} vectorStore 
 * @param {number} topK 
 * @returns {Promise<Array>}
 */
export async function searchVectorStore(question, vectorStore, topK = 3) {
  const queryEmbedding = await getEmbedding(question);

  const scoredChunks = vectorStore.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK);
}

/**
 * Generate a response using the Gemini LLM
 * @param {string} question 
 * @param {Array} topChunks 
 * @param {string} systemPrompt 
 * @returns {Promise<string>}
 */
export async function generateLLMResponse(question, topChunks, systemPrompt) {
  const contextText = topChunks.map((c) => `[Source: ${c.title} (${c.url})]\n${c.content}`).join("\n\n");

  const prompt = `${systemPrompt}

Context:
${contextText}

User Question: ${question}
Answer:`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini LLM Error: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
}
