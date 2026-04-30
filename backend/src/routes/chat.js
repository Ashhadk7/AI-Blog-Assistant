import { searchVectorStore, generateLLMResponse } from "../services/rag.js";

/**
 * Chat Endpoint for Web Widget
 */
export async function chatHandler(req, res, vectorStore) {
  console.log("Received request from Web Chat:", req.body);
  
  try {
    const question = req.body.message; 
    
    if (!question) {
      return res.status(400).json({ error: "Missing message parameter" });
    }

    // 1. & 2. Embed and Similarity Search
    const topChunks = await searchVectorStore(question, vectorStore);
    
    // 3. & 4. Build Context and Call LLM
    const systemPrompt = `You are a helpful assistant for an AI and Tech Blog. 
Use ONLY the following context to answer the user's question. If the answer is not contained in the context, say exactly: "I'm sorry, I don't have that information in my current blog knowledge." Do not hallucinate external information.`;

    const answer = await generateLLMResponse(question, topChunks, systemPrompt);
    
    res.json({ answer, sources: [...new Set(topChunks.map(c => c.url))] });

  } catch (error) {
    console.error("=== ERROR IN /chat ===");
    console.error("Message:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
