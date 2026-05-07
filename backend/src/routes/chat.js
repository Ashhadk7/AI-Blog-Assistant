import { searchVectorStore, generateLLMResponse } from "../services/rag.js";

/**
 * Chat Endpoint for Web Widget
 */
export async function chatHandler(req, res, vectorStore) {
  console.log("Received request from Web Chat:", req.body);
  
  try {
    const question = req.body.message; 
    const blogId = req.body.blogId; // Optional context filter
    
    if (!question) {
      return res.status(400).json({ error: "Missing message parameter" });
    }

    // 1. & 2. Embed and Similarity Search
    const topChunks = await searchVectorStore(question, vectorStore, 3, blogId);
    
    // 3. & 4. Build Context and Call LLM
    const systemPrompt = `You are the "AI Blog Expert," a specialized conversational assistant for this specific blog post.

STRICT GROUNDING RULES:
1. Use ONLY the provided context to answer. 
2. If the answer is not in the context, say: "I'm sorry, but this specific article doesn't cover that topic. I can only provide insights based on the current blog post."
3. Do NOT use your own internal knowledge or make assumptions.
4. If the context is empty, it means the question is completely irrelevant to the blog.

TONE & STYLE:
- Be professional, insightful, and friendly.
- Avoid robotic phrases like "Based on the text provided" or "According to the context."
- Instead, use phrases like "The article highlights..." or "Interestingly, the author mentions..."
- Provide clear, direct answers.`;

    const answer = await generateLLMResponse(question, topChunks, systemPrompt);
    
    res.json({ answer, sources: [...new Set(topChunks.map(c => c.url))] });

  } catch (error) {
    console.error("=== ERROR IN /chat ===");
    console.error("Message:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
