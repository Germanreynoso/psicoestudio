import { useState, useEffect, useRef } from 'react';
import { Brain, GraduationCap, Send, History, Loader2, PlusCircle, FileCheck, BookOpen, X, FileText, HelpCircle, Menu } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { generateAIResponse, getRelevantContext, evaluateResponse, saveManualContext } from './lib/ai';
import { saveChatMessage, createNewSession } from './services/api';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastEvaluation, setLastEvaluation] = useState<any>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [activeModule, setActiveModule] = useState<'exam' | 'doubt'>('exam');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 250)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const fetchDocs = async () => {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (data) setDocuments(data);
    setShowDocs(true);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const init = async () => {
      const session = await createNewSession();
      setSessionId(session.id);
    };
    init();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    try {
      const newMessages = [...messages, { role: 'user', content: userMessage, module: activeModule }];
      setMessages(newMessages);
      await saveChatMessage(sessionId, 'user', userMessage);

      const context = await getRelevantContext();

      let aiContent = "";

      if (activeModule === 'exam') {
        const evaluation = await evaluateResponse(userMessage, context);
        if (evaluation.isMeta) {
          aiContent = await generateAIResponse(context, newMessages, 'exam');
        } else {
          setLastEvaluation(evaluation);
          const nextQuestion = await generateAIResponse(context, newMessages, 'exam');
          aiContent = `**FEEDBACK DOCENTE:**\n${evaluation.feedback}\n\n---\n**CALIFICACIÓN:** ${evaluation.score}/10 | **NIVEL:** ${evaluation.level}\n---\n\n**SIGUIENTE PREGUNTA:**\n${nextQuestion}`;
          await saveChatMessage(sessionId, 'assistant', aiContent, evaluation);
        }
      } else {
        // MODO DUDA
        aiContent = await generateAIResponse(context, newMessages, 'doubt');
        await saveChatMessage(sessionId, 'assistant', aiContent);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: aiContent, module: activeModule }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {isSidebarOpen && <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      <aside className={`sidebar glass ${isSidebarOpen ? 'open' : ''}`}>
        <div className="logo-section">
          <Brain className="logo-icon" size={32} />
          <h2 className="logo-text">Estudio AI <span className="logo-pro">Pro</span></h2>
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(false)} style={{ marginLeft: 'auto' }}>
            <X size={24} />
          </button>
        </div>
        <nav className="nav-menu">
          <div className={`nav-item ${activeModule === 'exam' ? 'active' : ''}`} onClick={() => { setActiveModule('exam'); setIsSidebarOpen(false); }}>
            <GraduationCap size={20} /><span>Simulación Examen</span>
          </div>
          <div className={`nav-item ${activeModule === 'doubt' ? 'active' : ''}`} onClick={() => { setActiveModule('doubt'); setIsSidebarOpen(false); }}>
            <HelpCircle size={20} /><span>Consultas / Dudas</span>
          </div>
          <div className="nav-divider"></div>
          <div className="nav-item" onClick={() => { fetchDocs(); setIsSidebarOpen(false); }} style={{ cursor: 'pointer' }}><BookOpen size={20} /><span>Ver Material</span></div>
          <div className="nav-item"><History size={20} /><span>Historial</span></div>
        </nav>

      </aside>

      {/* MODAL DE MATERIAL */}
      {showDocs && (
        <div className="modal-overlay" onClick={() => setShowDocs(false)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><BookOpen size={24} /> Material Bibliográfico</h2>
              <button className="close-btn" onClick={() => setShowDocs(false)}><X size={24} /></button>
            </div>
            <div className="docs-grid">
              {documents.length === 0 ? <p>No hay documentos guardados.</p> : documents.map((doc, i) => (
                <div key={i} className="doc-card glass">
                  <div className="doc-card-header">
                    <FileText size={20} />
                    <h4>{doc.metadata?.source || 'Entrada manual'}</h4>
                  </div>
                  <div className="doc-card-body"><p>{doc.content.substring(0, 150)}...</p></div>
                  <div className="doc-card-footer"><span>{new Date(doc.created_at).toLocaleDateString()}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        <header className="main-header glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="exam-info">
              <h1>{activeModule === 'exam' ? 'Examen Final' : 'Consultas'}</h1>
              <p className="subtitle">{activeModule === 'exam' ? 'Evaluación' : 'Dudas'}</p>
            </div>
          </div>
          <div className="module-tabs">
            <button className={`tab ${activeModule === 'exam' ? 'active' : ''}`} onClick={() => setActiveModule('exam')}>Examen</button>
            <button className={`tab ${activeModule === 'doubt' ? 'active' : ''}`} onClick={() => setActiveModule('doubt')}>Dudas</button>
          </div>
        </header>

        <section className="chat-window">
          <div className="messages-container">
            {messages.filter(m => !m.module || m.module === activeModule).length === 0 && (
              <div className="message assistant glass">
                {activeModule === 'exam' ? (
                  <p>Bienvenido al módulo de <strong>Examen</strong>. Aquí evaluaré tu capacidad de integración teórica. ¿Empezamos?</p>
                ) : (
                  <p>Hola. Estoy aquí para resolver tus <strong>dudas</strong>. ¿Qué concepto de la bibliografía no te ha quedado claro?</p>
                )}
              </div>
            )}
            {messages.filter(m => !m.module || m.module === activeModule).map((m, i) => (
              <div key={i} className={`message ${m.role} glass`}>
                <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
            {isLoading && <div className="message assistant glass"><Loader2 className="animate-spin" /> Procesando...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area glass">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe tu respuesta analítica..."
              className="chat-input"
            />
            <button className="send-btn" onClick={handleSend} disabled={isLoading}><Send size={18} /></button>
          </div>
        </section>
      </main>

      <aside className="diagnostic-panel glass">
        <div className="panel-header"><h3><FileCheck size={18} /> Bibliografía Supabase</h3></div>

        <FileUpload onUploadSuccess={(name) => console.log('Subido a Supabase:', name)} />

        <div className="panel-header" style={{ marginTop: '1rem' }}><h3>Diagnóstico Evolutivo</h3></div>
        {!lastEvaluation ? (
          <div className="empty-state"><p>Resultados tras la primera respuesta.</p></div>
        ) : (
          <div className="diagnostic-results">
            <div className="metric-card">
              <h4>Nivel Académico</h4>
              <div className="level-badge">{lastEvaluation.level}</div>
            </div>
            <div className="metric-card">
              <h4>Nota</h4>
              <div className="score-value">{lastEvaluation.score}/10</div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default App;
