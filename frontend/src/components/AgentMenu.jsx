import { useState } from "react";
import VoiceWidget from "./VoiceWidget";
import ChatWidget from "./ChatWidget";

export default function AgentMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null); // 'voice' or 'chat'

  const toggleMenu = () => {
    if (activeAgent) {
      // If a widget is open, close it and show the menu
      setActiveAgent(null);
      setIsOpen(true);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const openChat = () => {
    setActiveAgent('chat');
    setIsOpen(false);
  };

  const openVoice = () => {
    setActiveAgent('voice');
    setIsOpen(false);
  };

  const closeAgent = () => {
    setActiveAgent(null);
    setIsOpen(false);
  };

  return (
    <>
      {/* Active Widgets */}
      {activeAgent === 'voice' && <VoiceWidget onClose={closeAgent} />}
      {activeAgent === 'chat' && <ChatWidget onClose={closeAgent} />}

      {/* Menu Options (only when open and no active agent) */}
      {isOpen && !activeAgent && (
        <div style={{
          position: "fixed", bottom: "100px", right: "30px",
          display: "flex", flexDirection: "column", gap: "10px", zIndex: 1001,
          animation: "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          <button onClick={openChat} style={menuButtonStyle}>
            💬 Open Chat
          </button>
          <button onClick={openVoice} style={menuButtonStyle}>
            🎤 Voice Agent
          </button>
        </div>
      )}

      {/* Main Toggle Button — always visible */}
      <button
        onClick={toggleMenu}
        style={{
          position: "fixed", bottom: "30px", right: "30px", width: "60px", height: "60px",
          borderRadius: "30px",
          backgroundColor: activeAgent === 'voice' ? "#ef4444" : activeAgent === 'chat' ? "#3b82f6" : "var(--accent)",
          color: "white",
          border: "none",
          boxShadow: activeAgent ? "0 10px 25px rgba(0,0,0,0.4)" : "0 10px 25px rgba(0,0,0,0.3)",
          cursor: "pointer",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1002, transition: "all 0.3s ease", fontSize: "24px",
          transform: isOpen ? "rotate(45deg)" : "rotate(0deg)"
        }}
        title={activeAgent ? "Close & switch" : "AI Assistant"}
      >
        {activeAgent === 'voice' ? "🎤" : activeAgent === 'chat' ? "💬" : (isOpen ? "+" : "✨")}
      </button>
    </>
  );
}

const menuButtonStyle = {
  padding: "12px 20px", borderRadius: "20px", backgroundColor: "var(--card-bg)",
  color: "var(--text-primary)", border: "1px solid var(--card-border)",
  cursor: "pointer", fontWeight: "500", backdropFilter: "blur(10px)",
  boxShadow: "0 5px 15px rgba(0,0,0,0.2)", textAlign: "right",
  transition: "all 0.2s ease",
  fontSize: "14px"
};
