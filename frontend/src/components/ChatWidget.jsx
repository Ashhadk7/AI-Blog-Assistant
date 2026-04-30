import { useState, useRef, useEffect } from "react";

export default function ChatWidget({ onClose }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I am the AI Blog Assistant. Ask me anything about our latest articles!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I am having trouble connecting to the brain right now!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", bottom: "100px", right: "30px",
      width: "350px", height: "500px",
      backgroundColor: "var(--card-bg)", backdropFilter: "blur(12px)",
      border: "1px solid var(--card-border)", borderRadius: "16px",
      display: "flex", flexDirection: "column",
      boxShadow: "0 20px 40px rgba(0,0,0,0.5)", zIndex: 1000,
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        padding: "15px", borderBottom: "1px solid var(--card-border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        backgroundColor: "rgba(139, 92, 246, 0.1)"
      }}>
        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>💬 Blog Chat</h3>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-secondary)",
          cursor: "pointer", fontSize: "20px"
        }}>×</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            backgroundColor: msg.role === "user" ? "var(--accent)" : "rgba(255,255,255,0.1)",
            padding: "10px 15px", borderRadius: "12px",
            maxWidth: "80%", fontSize: "14px", lineHeight: "1.4"
          }}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: "flex-start", padding: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
            Typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{
        padding: "15px", borderTop: "1px solid var(--card-border)", display: "flex", gap: "10px"
      }}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          style={{
            flex: 1, padding: "10px", borderRadius: "8px",
            border: "1px solid var(--card-border)", backgroundColor: "rgba(0,0,0,0.2)",
            color: "white", outline: "none"
          }}
        />
        <button type="submit" disabled={isLoading || !input.trim()} style={{
          padding: "10px 15px", borderRadius: "8px", backgroundColor: "var(--accent)",
          color: "white", border: "none", cursor: "pointer", opacity: (isLoading || !input.trim()) ? 0.5 : 1
        }}>
          Send
        </button>
      </form>
    </div>
  );
}
