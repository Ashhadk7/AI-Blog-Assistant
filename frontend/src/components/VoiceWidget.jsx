import { useEffect, useState, useRef, useCallback } from "react";
import VapiPkg from "@vapi-ai/web";

// Handle Vite CJS/ESM interop — create ONE instance, outside the component
const VapiClass = VapiPkg.default || VapiPkg;
let vapi = null;
function getVapi() {
  if (!vapi) {
    vapi = new VapiClass("e41b43e8-9913-44ff-acf8-231761e89629");
  }
  return vapi;
}

// ✅ This ID is PERMANENT — server.js auto-updates the webhook URL on every restart
const ASSISTANT_ID = "4503b47e-1080-4f77-b5b7-ebfcbfef9228";

export default function VoiceWidget({ onClose, blogId }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [activePartial, setActivePartial] = useState(null);
  const [error, setError] = useState(null);
  const [publicUrl, setPublicUrl] = useState("");
  const transcriptsEndRef = useRef(null);
  const listenersAttached = useRef(false);

  // Fetch the public tunnel URL from the backend with polling
  useEffect(() => {
    const fetchConfig = () => {
      fetch("http://localhost:3000/api/config")
        .then(res => res.json())
        .then(data => {
          if (data.publicUrl) {
            setPublicUrl(data.publicUrl);
            setError(null); // Clear any "Connecting..." errors automatically
            console.log("✅ Voice backend ready at:", data.publicUrl);
          }
        })
        .catch(err => console.error("Failed to fetch public URL:", err));
    };

    fetchConfig(); // Initial check
    const interval = setInterval(() => {
      if (!publicUrl) fetchConfig();
    }, 2000);

    return () => clearInterval(interval);
  }, [publicUrl]);

  // Auto-scroll to bottom when transcripts update
  useEffect(() => {
    if (transcriptsEndRef.current) {
      transcriptsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, activePartial]);

  // Attach Vapi event listeners ONCE
  useEffect(() => {
    const vapiInstance = getVapi();

    // Prevent duplicate listeners from React Strict Mode double-mount
    if (listenersAttached.current) return;
    listenersAttached.current = true;

    // Remove any stale listeners from previous mounts
    vapiInstance.removeAllListeners();

    vapiInstance.on("call-start", () => {
      console.log("✅ Vapi call started");
      setIsConnecting(false);
      setIsConnected(true);
      setError(null);
    });

    vapiInstance.on("call-end", () => {
      console.log("📞 Vapi call ended");
      setIsConnecting(false);
      setIsConnected(false);
      setActivePartial(null);
    });

    vapiInstance.on("speech-start", () => {
      console.log("🗣️ AI started speaking");
    });

    vapiInstance.on("speech-end", () => {
      console.log("🔇 AI stopped speaking");
    });

    vapiInstance.on("message", (msg) => {
      console.log("📨 Vapi message:", JSON.stringify(msg).substring(0, 200));

      if (msg.type === "transcript") {
        const role = msg.role; // "user" or "assistant"
        const text = msg.transcript;
        const isFinal = msg.transcriptType === "final";

        if (!text || text.trim() === "") return;

        if (isFinal) {
          setTranscripts(prev => {
            // Prevent duplicate entries (Vapi sometimes fires the same final twice)
            const last = prev[prev.length - 1];
            if (last && last.role === role && last.text === text) {
              return prev;
            }
            return [...prev, { role, text }];
          });
          setActivePartial(null);
        } else {
          setActivePartial({ role, text });
        }
      }
    });

    vapiInstance.on("error", (e) => {
      console.error("❌ Vapi Error:", e);
      // Log to backend for developer
      fetch("http://localhost:3000/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: e, message: "Vapi Error" })
      }).catch(() => {});

      // Walk the nested Vapi error object to extract a readable string
      // Vapi errors look like: { type, error: { errorMsg, error: { msg } } }
      const extractMsg = (obj) => {
        if (!obj) return null;
        if (typeof obj === "string") return obj;
        return (
          obj.errorMsg ||
          obj.msg ||
          (typeof obj.message === "string" ? obj.message : null) ||
          (typeof obj.error === "string" ? obj.error : null) ||
          extractMsg(obj.error) ||
          extractMsg(obj.message) ||
          null
        );
      };

      const rawMsg = extractMsg(e);
      // Map internal Vapi errors to friendly messages
      let friendlyMsg = "Connection ended. Please tap to try again.";
      if (rawMsg) {
        if (rawMsg.toLowerCase().includes("ejected") || rawMsg.toLowerCase().includes("meeting has ended")) {
          friendlyMsg = "Session ended. Tap to start a new one.";
        } else if (rawMsg.toLowerCase().includes("audio") || rawMsg.toLowerCase().includes("mic")) {
          friendlyMsg = "Microphone issue. Check permissions and try again.";
        } else if (rawMsg.toLowerCase().includes("timeout")) {
          friendlyMsg = "Connection timed out. Please try again.";
        } else {
          friendlyMsg = rawMsg;
        }
      }

      setError(friendlyMsg);
      setIsConnecting(false);
    });

    return () => {
      // Cleanup on unmount
      listenersAttached.current = false;
      vapiInstance.removeAllListeners();
      // If a call is active, stop it when closing the widget
      if (vapiInstance.call) {
        vapiInstance.stop();
      }
    };
  }, []);

  const handleToggleCall = useCallback(() => {
    const vapiInstance = getVapi();

    if (isConnected) {
      vapiInstance.stop();
      return;
    }

    if (!isConnecting) {
      if (!publicUrl) {
        setError("Still searching for AI Brain... Please wait for the green light.");
        return;
      }

      setError(null);
      setIsConnecting(true);
      setTranscripts([]);
      setActivePartial(null);
      
      console.log("🚀 Starting Expert Voice Session with URL:", publicUrl, "Blog ID:", blogId);

      vapiInstance.start(ASSISTANT_ID, {
        variableValues: {
          blogId: String(blogId)
        },
        model: {
          provider: "custom-llm",
          url: `${publicUrl}/v1/chat/completions?blogId=${blogId}`,
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are an AI Blog Expert. You ONLY answer questions about blog article BlogId:${blogId}. If asked about topics not in this article, politely refuse. Keep responses concise and conversational for voice.`
            }
          ]
        }
      }).catch((err) => {
        console.error("Vapi start error:", err);
        const errMsg = err?.message || "Check mic permissions or Vapi keys.";
        setError(`Connection Failed: ${errMsg}`);
        setIsConnecting(false);
      });
    }
  }, [isConnected, isConnecting, blogId, publicUrl]);

  const handleClose = useCallback(() => {
    const vapiInstance = getVapi();
    if (isConnected) {
      vapiInstance.stop();
    }
    onClose();
  }, [isConnected, onClose]);

  return (
    <div className="voice-widget-container" style={{
      position: "fixed", bottom: "100px", right: "30px",
      width: "370px", height: "520px",
      backgroundColor: "var(--card-bg)", backdropFilter: "blur(16px)",
      border: "1px solid var(--card-border)", borderRadius: "20px",
      display: "flex", flexDirection: "column",
      boxShadow: "0 25px 50px rgba(0,0,0,0.5)", zIndex: 1000,
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--card-border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))",
        flexShrink: 0
      }}>
        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "10px" }}>
          <span className={`status-dot ${isConnected ? 'online' : ''}`}></span>
          🎤 Voice Agent
          {isConnected && <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 400 }}>LIVE</span>}
        </h3>
        <button onClick={handleClose} style={{
          background: "none", border: "none", color: "var(--text-secondary)",
          cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "4px"
        }}>×</button>
      </div>

      {/* Transcripts Area */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px",
        display: "flex", flexDirection: "column", gap: "12px",
        scrollBehavior: "smooth"
      }}>
        {/* Initial message if no transcripts yet */}
        {transcripts.length === 0 && !activePartial && !isConnected && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "var(--text-secondary)", fontSize: "14px"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎙️</div>
            <p style={{ margin: "0 0 8px 0" }}>Tap the microphone to start</p>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>
              Ask about our blog articles on AI, web dev, and more
            </p>
          </div>
        )}

        {/* Transcript bubbles */}
        {transcripts.map((t, i) => (
          <div key={`${i}-${t.role}-${t.text.substring(0, 20)}`} className={`transcript-bubble ${t.role}`}>
            <span style={{ fontSize: "11px", opacity: 0.6, display: "block", marginBottom: "4px" }}>
              {t.role === "user" ? "You" : "AI Assistant"}
            </span>
            {t.text}
          </div>
        ))}

        {/* Active partial transcript (what's currently being said) */}
        {activePartial && (
          <div className={`transcript-bubble ${activePartial.role} partial`}>
            <span style={{ fontSize: "11px", opacity: 0.6, display: "block", marginBottom: "4px" }}>
              {activePartial.role === "user" ? "You" : "AI Assistant"}
            </span>
            {activePartial.text}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: "10px",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            color: "#f87171", fontSize: "13px", textAlign: "center"
          }}>
            ⚠️ {error}
          </div>
        )}

        <div ref={transcriptsEndRef} />
      </div>

      {/* Footer / Controls */}
      <div style={{
        padding: "24px 20px", borderTop: "1px solid var(--card-border)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
        background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent)",
        flexShrink: 0
      }}>
        {/* Wave Animation when connected */}
        {isConnected && (
          <div className="voice-waves">
            <div className="wave"></div>
            <div className="wave"></div>
            <div className="wave"></div>
            <div className="wave"></div>
            <div className="wave"></div>
          </div>
        )}

        <button
          onClick={handleToggleCall}
          className={`mic-button ${isConnected ? 'active' : ''} ${isConnecting ? 'connecting' : ''}`}
          disabled={isConnecting}
          title={isConnected ? "End call" : "Start call"}
        >
          {isConnecting ? (
            <div className="spinner"></div>
          ) : isConnected ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
              <line x1="23" y1="1" x2="1" y2="23"></line>
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          )}
        </button>

        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", fontWeight: "500" }}>
          {isConnected ? "Tap to end call" : (isConnecting ? "Connecting..." : "Tap to speak")}
        </p>

        {/* Connection Status Indicator */}
        <div style={{ 
          marginTop: '4px', 
          fontSize: '11px', 
          color: publicUrl ? '#4ade80' : '#fb7185',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          opacity: 0.8
        }}>
          <div style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            backgroundColor: publicUrl ? '#4ade80' : '#fb7185',
            boxShadow: publicUrl ? '0 0 8px #4ade80' : 'none'
          }} />
          {publicUrl ? "AI Brain Connected" : "Searching for AI Brain..."}
        </div>
      </div>
    </div>
  );
}
