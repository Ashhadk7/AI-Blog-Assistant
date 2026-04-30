# 🚀 AI Blog Assistant: Voice & Chat Powered by RAG

A state-of-the-art AI-powered blog platform featuring a premium dark-mode interface and a dual-mode intelligent assistant. This project demonstrates a complete RAG (Retrieval-Augmented Generation) implementation using Google's Gemini models.

![Project Preview](https://via.placeholder.com/1200x600/0f172a/8b5cf6?text=AI+Blog+Assistant+Preview)

## 🌟 Key Features

- **💎 Premium Design**: Sleek, glassmorphic UI built with React and Vanilla CSS, featuring smooth animations and a responsive layout.
- **💬 AI Chat Widget**: Instant text-based assistant capable of answering questions about any blog article with high accuracy.
- **🎤 Vapi Voice Agent**: Fully interactive voice assistant for hands-free exploration of blog content.
- **🧠 Advanced RAG Pipeline**:
  - **Embeddings**: Uses `gemini-embedding-2` for high-dimensional semantic search.
  - **Retrieval**: Local vector store with cosine similarity for fast, relevant context extraction.
  - **Generation**: Powered by `gemini-2.5-flash` for intelligent, grounded, and conversational responses.
- **🔄 Hot-Reloading**: Backend automatically reloads the knowledge base whenever new articles are ingested.

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, React Router, Vapi Web SDK.
- **Backend**: Node.js, Express, Google Generative AI (Gemini).
- **Tooling**: Cloudflared (for Vapi webhooks), Dotenv.

## 📁 Project Structure

```text
├── frontend/             # React Application (currently AI-blog)
│   ├── src/components/   # UI Widgets (Chat, Voice, AgentMenu)
│   ├── src/data/         # Blog source data
│   └── ...
├── backend/              # Node.js Express Server
│   ├── src/routes/       # Modular API endpoints
│   ├── src/services/     # Embedding & RAG logic
│   ├── data/             # Vector Store (JSON)
│   └── scripts/          # Ingestion & setup scripts
└── README.md             # Project documentation
```

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Gemini API Key](https://aistudio.google.com/)
- [Vapi Account](https://vapi.ai/) (for voice assistant)

### 2. Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ashhadk7/AI-Blog-Assistant.git
   cd AI-Blog-Assistant
   ```

2. **Setup Backend:**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend/` folder:
   ```env
   GEMINI_API_KEY=your_key
   VAPI_PRIVATE_KEY=your_key
   VAPI_ASSISTANT_ID=your_id
   ```

3. **Setup Frontend:**
   ```bash
   cd ../AI-blog
   npm install
   ```

### 3. Running the App

1. **Ingest Blog Data (Backend):**
   ```bash
   cd backend
   npm run ingest
   ```

2. **Start Backend Server:**
   ```bash
   npm run dev
   ```

3. **Start Frontend App:**
   ```bash
   cd ../AI-blog
   npm run dev
   ```

## 📖 Detailed Description

This project serves as a comprehensive example of integrating modern LLMs into a web application. 

### How it works:
1. **The Ingestion Phase**: The system reads raw blog data from `blogs.js`. Each article is processed, summarized, and split into chunks. These chunks are transformed into 3072-dimensional vectors (embeddings) using the Gemini API and stored locally.
2. **The Query Phase**: When a user asks a question via Chat or Voice, their input is also embedded. The system performs a mathematical comparison (Cosine Similarity) against the stored vectors to find the most relevant pieces of information.
3. **The Response Phase**: The retrieved "context" is fed into the `gemini-2.5-flash` model alongside the original question. This ensures the AI answers based **only** on the blog's content, preventing hallucinations and providing accurate information.

## 📄 License
This project is licensed under the MIT License.
