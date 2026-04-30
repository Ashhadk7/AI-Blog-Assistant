import { searchVectorStore, generateLLMResponse } from "../services/rag.js";

/**
 * Vapi Webhook Endpoint
 */
export async function askHandler(req, res, vectorStore) {
  console.log("Received request from Vapi:", req.body);
  
  try {
    let question = req.body.question; 
    let toolCallId = null;
    
    // Check if it's a Vapi Tool Call request
    if (req.body.message && req.body.message.toolCalls && req.body.message.toolCalls.length > 0) {
      const toolCall = req.body.message.toolCalls[0];
      if (toolCall.function && toolCall.function.name === "ask_blog") {
        question = toolCall.function.arguments.question;
        toolCallId = toolCall.id;
      }
    }

    if (!question) {
      return res.status(400).json({ error: "Missing question parameter" });
    }

    console.log(`Searching for: "${question}"`);

    // 1. & 2. Embed and Similarity Search
    const topChunks = await searchVectorStore(question, vectorStore);
    
    // 3. & 4. Build Context and Call LLM
    const systemPrompt = `You are a helpful and highly knowledgeable assistant for an AI and Tech Blog. 
Use ONLY the following context to answer the user's question. If the answer is not contained in the context, say exactly: "I'm sorry, I don't have that information in my current blog knowledge." Do not hallucinate external information. Keep your answer conversational and brief, suitable for voice output.`;

    const answer = await generateLLMResponse(question, topChunks, systemPrompt);

    // Vapi requires a specific response format for tool calls
    if (toolCallId) {
      return res.json({
        results: [
          {
            toolCallId: toolCallId,
            result: answer
          }
        ]
      });
    }

    // Standard fallback response
    res.json({ answer, sources: topChunks.map(c => c.url) });

  } catch (error) {
    console.error("=== ERROR IN /ask-blog ===");
    console.error("Message:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
