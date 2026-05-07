/**
 * Local Extractive Response Generator
 * Builds answers PURELY from blog content retrieved via RAG.
 * No external LLM API is called — every response comes from the blog.
 */

/**
 * Score a sentence against the user's question keywords.
 * @param {string} sentence
 * @param {string[]} keywords
 * @returns {number}
 */
function scoreSentence(sentence, keywords) {
  const lower = sentence.toLowerCase();
  return keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
}

/**
 * Split text into clean sentences.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+/g) || [text])
    .map(s => s.trim())
    .filter(s => s.length > 15);
}

/**
 * Build a concise, voice-friendly response from retrieved blog chunks.
 * @param {string} question  — the user's spoken question
 * @param {Array}  topChunks — array of { title, content, url, score }
 * @returns {string}
 */
export function buildLocalResponse(question, topChunks) {
  // ── No context available ──────────────────────────────────────────────────
  if (!topChunks || topChunks.length === 0) {
    return (
      "I don't have information about that in our blog. " +
      "You can ask me about our articles on healthcare, web development, ethical AI, or quantum computing."
    );
  }

  // ── Keyword extraction (meaningful words only) ────────────────────────────
  const stopWords = new Set([
    "can", "you", "tell", "me", "about", "what", "is", "are", "the", "a",
    "an", "in", "on", "of", "to", "and", "or", "how", "does", "do", "it",
    "this", "that", "with", "for", "from", "was", "were", "been", "has",
    "have", "had", "will", "would", "could", "should", "please", "give",
    "explain", "describe", "more"
  ]);

  const keywords = question
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // ── Score every sentence across all chunks ────────────────────────────────
  const allSentences = [];

  for (const chunk of topChunks) {
    const sentences = splitSentences(chunk.content);
    for (const sentence of sentences) {
      allSentences.push({
        text: sentence,
        score: scoreSentence(sentence, keywords),
        chunkScore: chunk.score || 0,
        title: chunk.title
      });
    }
  }

  // Sort by keyword hits first, then by chunk relevance score
  allSentences.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : b.chunkScore - a.chunkScore
  );

  // ── Only use sentences that actually match the question ──────────────────
  // Requirement: The top chunk must have at least 2 keyword hits to be considered "Expert Knowledge"
  const topScore = topChunks[0]?.score || 0;
  const chosen = (topScore >= 2) 
    ? allSentences.filter(s => s.score > 0).slice(0, 2).map(s => s.text) 
    : [];

  // ── Refusal Logic: If no strong match found, refuse to answer ──────────────
  if (chosen.length === 0) {
    return (
      "I'm sorry, as an expert on this specific article, I don't see any detailed mention of that topic here. " +
      "I'm specialized in the content of this specific post. Is there something else about this article you'd like to discuss?"
    );
  }

  const responseBody = chosen.join(" ").trim();

  // ── Add Conversational Shells for a "Human Expert" feel ───────────────────
  const prefixes = [
    "That's a really insightful question!",
    "Actually, our blog article discusses exactly that.",
    "Well, interestingly, the author touches on this point.",
    "I found some great information about that in the article.",
    "Sure! As a blog expert, I can tell you that",
    "Actually, this is one of the most interesting parts of the piece."
  ];
  
  const transitions = [
    "The article mentions that",
    "Specifically, it says",
    "The author highlights that",
    "One key takeaway is that",
    "It's noted in the blog that"
  ];

  const reflections = [
    "It's a fascinating look at where the industry is heading.",
    "This is a major point the blog tries to emphasize.",
    "I hope that gives you a better idea of the author's perspective!",
    "It's definitely something that's sparking a lot of conversation lately.",
    "You can find even more details on this in the full article."
  ];

  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const trans = transitions[Math.floor(Math.random() * transitions.length)];
  const reflection = reflections[Math.floor(Math.random() * reflections.length)];

  // Create a natural, flowing response
  let finalResponse = `${prefix} ${trans} ${responseBody} ${reflection}`;

  // ── Keep voice response concise (≤ 320 characters for speed/clarity) ──────
  if (finalResponse.length > 320) {
    finalResponse = finalResponse.substring(0, 317) + "...";
  }

  return finalResponse;
}

/**
 * Build a response for the /ask-blog webhook endpoint.
 * Returns a slightly longer, still grounded answer.
 * @param {string} question
 * @param {Array}  topChunks
 * @param {string} systemPrompt  — kept for signature compatibility, not used
 * @returns {string}
 */
export function generateLocalResponse(question, topChunks, systemPrompt) {
  if (!topChunks || topChunks.length === 0) {
    return (
      "I'm sorry, I don't see that specific topic covered in this blog article. " +
      "I can only discuss what's written here, but feel free to ask about our other tech topics!"
    );
  }

  const keywords = question.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 3);

  const allSentences = [];
  for (const chunk of topChunks) {
    for (const sentence of splitSentences(chunk.content)) {
      allSentences.push({
        text: sentence,
        score: scoreSentence(sentence, keywords),
        chunkScore: chunk.score || 0
      });
    }
  }

  allSentences.sort((a, b) => b.score !== a.score ? b.score - a.score : b.chunkScore - a.chunkScore);

  const best = allSentences.filter(s => s.score > 0).slice(0, 3);
  const fallback = splitSentences(topChunks[0].content).slice(0, 2);

  const chosen = best.length > 0 ? best.map(s => s.text) : fallback;
  let response = chosen.join(" ").trim();

  // Add a friendly expert touch
  const additions = [
    " It's a key takeaway from our research on the topic.",
    " The article highlights this as a major trend to watch.",
    " It's quite an interesting perspective from the author.",
    " This aligns with what we're seeing across the tech landscape lately."
  ];
  response += additions[Math.floor(Math.random() * additions.length)];

  if (response.length > 450) {
    response = response.substring(0, 447) + "...";
  }

  return response;
}
