import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import BlogPage from "./pages/BlogPage";
import Navbar from "./components/Navbar";
import AgentMenu from "./components/AgentMenu";

export default function App() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blog/:id" element={<BlogPage />} />
        </Routes>
      </main>
      <AgentMenu />
    </div>
  );
}