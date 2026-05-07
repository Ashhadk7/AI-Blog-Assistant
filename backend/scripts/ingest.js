import { blogs } from "../data/blogs.js";
import { ingestBlogs } from "../src/services/ingestion.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    await ingestBlogs(blogs);
    process.exit(0);
  } catch (err) {
    console.error("Ingestion failed:", err);
    process.exit(1);
  }
}

run();
