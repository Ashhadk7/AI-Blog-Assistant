import { blogs } from "../data/blogs.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getEmbedding } from "../src/services/embedding.js";

// Load environment variables
dotenv.config();

/**
 * Chunking function
 * @param {string} text 
 * @param {number} maxWords 
 * @param {number} overlap 
 * @returns {string[]}
 */
function chunkText(text, maxWords = 300, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  let i = 0;
  
  while (i < words.length) {
    const chunk = words.slice(i, i + maxWords).join(" ");
    chunks.push(chunk);
    if (i + maxWords >= words.length) break;
    i += (maxWords - overlap);
  }
  return chunks;
}

async function ingestBlogs() {
  console.log("Starting blog ingestion...");
  const vectorStore = [];

  for (const blog of blogs) {
    console.log(`Processing: ${blog.title}`);
    
    // Combine title, summary, and content for chunking
    const fullText = `${blog.title}\n\n${blog.summary}\n\n${blog.content}`;
    const chunks = chunkText(fullText);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      
      try {
        const embedding = await getEmbedding(chunkText);
        
        vectorStore.push({
          id: `${blog.id}_chunk_${i}`,
          blogId: blog.id,
          title: blog.title,
          url: `/blog/${blog.id}`, // Route in our React app
          content: chunkText,
          embedding: embedding,
        });
        
        console.log(`  - Embedded chunk ${i + 1}/${chunks.length}`);
      } catch (error) {
        console.error(`Error embedding chunk ${i} of ${blog.title}:`, error.message);
      }
    }
  }

  // Save to JSON in the data folder
  const outputPath = path.join(process.cwd(), "data", "vector_store.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(vectorStore, null, 2)
  );
  
  console.log(`Ingestion complete! Embedded ${vectorStore.length} chunks to ${outputPath}`);
}

ingestBlogs();
