import fs from "fs";
import path from "path";
import { getEmbedding } from "./embedding.js";
import * as cheerio from 'cheerio';
import fetch from "node-fetch";

const vectorStorePath = path.join(process.cwd(), "data", "vector_store.json");

/**
 * Chunking function
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

/**
 * Scrapes a URL for content
 * @param {string} url 
 * @returns {Promise<{title: string, content: string}>}
 */
export async function scrapeUrl(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Simple logic to get title and main text
    const title = $('title').text() || $('h1').first().text();
    
    // Remove scripts, styles, etc.
    $('script, style, nav, footer, header').remove();
    const content = $('body').text().replace(/\s+/g, ' ').trim();
    
    return { title, content };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    throw error;
  }
}

/**
 * Ingests all blogs from a provided array
 * @param {Array} blogs 
 */
export async function ingestBlogs(blogs) {
  console.log("🔄 Starting blog ingestion...");
  const vectorStore = [];

  for (const blog of blogs) {
    console.log(`Processing: ${blog.title}`);
    
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
          url: `/blog/${blog.id}`,
          content: chunkText,
          embedding: embedding,
        });
        
      } catch (error) {
        console.error(`Error embedding chunk ${i} of ${blog.title}:`, error.message);
      }
    }
    console.log(`  - Embedded ${chunks.length} chunks for "${blog.title}"`);
  }

  // Save to JSON
  fs.writeFileSync(
    vectorStorePath,
    JSON.stringify(vectorStore, null, 2)
  );
  
  console.log(`✅ Ingestion complete! Total chunks: ${vectorStore.length}`);
  return vectorStore;
}
