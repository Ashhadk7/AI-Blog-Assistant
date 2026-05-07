import { searchVectorStore, generateLLMResponse } from "../services/rag.js";

/**
 * Vapi Webhook Endpoint
 */
export async function askHandler(req, res, vectorStore) {
  // console.log("Received request from Vapi:", JSON.stringify(req.body).slice(0, 100)); // Suppressed
  
  try {
    let question = req.body.question;
    let blogId = req.query.blogId || req.body.blogId; // Support query param or body
    let toolCallId = null;

    // Check if it's a Vapi Tool Call request
    if (req.body.message && req.body.message.toolCalls && req.body.message.toolCalls.length > 0) {
      const toolCall = req.body.message.toolCalls[0];
      if (toolCall.function && toolCall.function.name === "ask_blog") {
        question = toolCall.function.arguments.question;
        // Check if blogId was passed in tool arguments too
        blogId = blogId || toolCall.function.arguments.blogId;
        toolCallId = toolCall.id;
      }
    }

    if (!question) {
      return res.status(400).json({ error: "Missing question parameter" });
    }

    console.log(`Searching for: "${question}" (Context: ${blogId || 'All'})`);

    // 1. & 2. Embed and Similarity Search
    const topChunks = await searchVectorStore(question, vectorStore, 3, blogId);

    // 3. & 4. Build Context and Call LLM
    const systemPrompt = `You are a friendly tech expert having a natural, casual conversation about this blog post.

CONVERSATION RULES:
1. Be extremely brief and conversational. Use short sentences (max 2 per response).
2. Sound like a human, not a bot. Use natural transitions like "Well," "Actually," or "Oh, interestingly..."
3. STRICT GROUNDING: Use ONLY the provided context. If it's not there, say: "I'm sorry, I don't see that in this article. I only know what's written here!"
4. NEVER say "Based on the context" or "The text says." Just talk about the topic naturally.
5. If the context is missing, it means the user is off-topic. Remind them you're here to talk about this specific blog.

Example: "The author mentions that AI is really changing how doctors work, especially with medical imaging. It's pretty fascinating!"`;

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
