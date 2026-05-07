import { generateStreamingLLMResponse, searchVectorStore } from "../services/rag.js";

/**
 * Custom LLM Handler for Vapi (OpenAI-Compatible Streaming)
 * 
 * Implements SSE (Server-Sent Events) in the exact OpenAI streaming format:
 *   1. First chunk: role announcement  → delta: {role: "assistant", content: ""}
 *   2. Content chunks:                 → delta: {content: "token"}
 *   3. Final chunk:                    → delta: {}, finish_reason: "stop"
 *   4. Done marker:                    → data: [DONE]
 * 
 * Critical: Headers are flushed immediately so Cloudflare Tunnel doesn't buffer.
 */
export async function customLLMHandler(req, res, vectorStore) {
  // ── 1. Set SSE headers and flush immediately ─────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx/proxy buffering
  res.flushHeaders(); // CRITICAL: Forces headers out through Cloudflare Tunnel

  const completionId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const created = Math.floor(Date.now() / 1000);

  /**
   * Send a single SSE chunk in OpenAI format
   */
  const sendSSE = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // Connection may have been closed by Vapi
    }
  };

  /**
   * Send the initial role announcement chunk (required by Vapi/OpenAI format)
   */
  const sendRoleChunk = () => {
    sendSSE({
      id: completionId,
      object: "chat.completion.chunk",
      created,
      model: "gpt-3.5-turbo",
      choices: [{
        index: 0,
        delta: { role: "assistant", content: "" },
        finish_reason: null
      }]
    });
  };

  /**
   * Send a content token chunk
   */
  const sendContentChunk = (token) => {
    sendSSE({
      id: completionId,
      object: "chat.completion.chunk",
      created,
      model: "gpt-3.5-turbo",
      choices: [{
        index: 0,
        delta: { content: token },
        finish_reason: null
      }]
    });
  };

  /**
   * Send the final stop chunk + [DONE] marker and end the stream
   */
  const endStream = () => {
    sendSSE({
      id: completionId,
      object: "chat.completion.chunk",
      created,
      model: "gpt-3.5-turbo",
      choices: [{
        index: 0,
        delta: {},
        finish_reason: "stop"
      }]
    });
    res.write("data: [DONE]\n\n");
    res.end();
  };

  try {
    // ── 2. Extract the user's question from the messages ────────────────────
    const messages = req.body.messages || req.body.message?.messages || [];
    const lastMessage = messages[messages.length - 1];
    const question = lastMessage?.content || "";

    // ── 3. Extract blogId from multiple sources (redundant for reliability) ─
    //    Priority: query param → system message regex → variable values
    const systemContent = messages.find(m => m.role === "system")?.content || "";
    const blogIdFromSystem = systemContent.match(/BlogId[:\s]*(\d+)/i)?.[1];
    
    const rawBlogId = req.query.blogId 
      || blogIdFromSystem 
      || req.body.message?.variableValues?.blogId 
      || req.body.variableValues?.blogId
      || null;

    // Strictly extract only the digits to avoid "2/chat/completions" bugs
    const blogId = rawBlogId ? String(rawBlogId).match(/\d+/)?.[0] : null;

    console.log("\n══════════════════════════════════════════════════");
    console.log(`🎙️  VOICE QUERY: "${question.substring(0, 80)}"`);
    console.log(`📌  Blog Scope: ${blogId || "ALL (no filter)"}`);
    console.log(`📝  System msg: "${systemContent.substring(0, 60)}..."`);

    // ── 4. Send the role announcement IMMEDIATELY ──────────────────────────
    //    This tells Vapi "the assistant is about to speak" and prevents timeout
    sendRoleChunk();

    // ── 5. RAG: Semantic search scoped to the active blog ──────────────────
    const topChunks = await searchVectorStore(question, vectorStore, 3, blogId);

    console.log(`🔎  RAG Results: ${topChunks.length} chunks found`);
    if (topChunks.length > 0) {
      console.log(`    Top chunk: "${topChunks[0].title}" (score: ${topChunks[0].score?.toFixed(4)})`);
    }

    // ── 6. If no relevant context found, send a scoped refusal ─────────────
    if (topChunks.length === 0) {
      const refusal = "I'm sorry, I don't see that topic covered in this article. I can only discuss what's written in this specific blog post. Could you ask me something else about it?";
      sendContentChunk(refusal);
      endStream();
      console.log("⚠️  No relevant chunks — sent scoped refusal");
      return;
    }

    // ── 7. Stream from Gemini LLM with context ─────────────────────────────
    let tokenCount = 0;

    await generateStreamingLLMResponse(question, topChunks, (token) => {
      tokenCount++;
      sendContentChunk(token);
    });

    console.log(`✅  Streamed ${tokenCount} tokens to Vapi`);

    // ── 8. Finalize the stream ─────────────────────────────────────────────
    endStream();

  } catch (err) {
    console.error("❌ Custom LLM Error:", err.message);

    // Even on error, send a valid response so Vapi doesn't hang
    try {
      sendContentChunk("I'm having a moment, could you repeat that question?");
      endStream();
    } catch (e) {
      // Connection already closed
      try { res.end(); } catch (_) {}
    }
  }
}
