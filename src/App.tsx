import { useState, useEffect, useRef } from 'react';
import { Brain, GraduationCap, Send, History, Loader2, FileCheck, BookOpen, X, FileText, HelpCircle, Menu } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { generateAIResponse, getRelevantContext, evaluateResponse, generateFlashcards, getContextByIds } from './lib/ai';
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
  const [activeModule, setActiveModule] = useState<'exam' | 'doubt' | 'flashcards'>('exam');
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
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

  const fetchAllDocsForSelection = async () => {
    const { data } = await supabase.from('documents').select('id, metadata, created_at, content').order('created_at', { ascending: false });
    if (data) setDocuments(data);
  };

  useEffect(() => {
    if (activeModule === 'flashcards') {
      fetchAllDocsForSelection();
    }
  }, [activeModule]);

  const handleGenerateFlashcards = async () => {
    if (selectedDocIds.length === 0) {
      alert("Por favor, selecciona al menos un texto bibliográfico.");
      return;
    }
    setIsLoading(true);
    try {
      const context = await getContextByIds(selectedDocIds);
      const result = await generateFlashcards(context);
      if (result.flashcards) {
        setFlashcards(result.flashcards);
        setCurrentFlashcardIndex(0);
        setIsFlipped(false);
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
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
          <div className={`nav-item ${activeModule === 'flashcards' ? 'active' : ''}`} onClick={() => { setActiveModule('flashcards'); setIsSidebarOpen(false); }}>
            <FileCheck size={20} /><span>Smart Flashcards</span>
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
                  <div className="doc-card-body"><p>{doc.content?.substring(0, 150) || 'Sin contenido'}...</p></div>
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
              <h1>{activeModule === 'exam' ? 'Examen Final' : activeModule === 'doubt' ? 'Consultas' : 'Flashcards'}</h1>
              <p className="subtitle">{activeModule === 'exam' ? 'Evaluación de Especialidad' : activeModule === 'doubt' ? 'Resolución de dudas' : 'Aprendizaje Acelerado'}</p>
            </div>
          </div>
          <div className="module-tabs">
            <button className={`tab ${activeModule === 'exam' ? 'active' : ''}`} onClick={() => setActiveModule('exam')}>Examen</button>
            <button className={`tab ${activeModule === 'doubt' ? 'active' : ''}`} onClick={() => setActiveModule('doubt')}>Dudas</button>
            <button className={`tab ${activeModule === 'flashcards' ? 'active' : ''}`} onClick={() => setActiveModule('flashcards')}>Flashcards</button>
          </div>
        </header>

        <section className="chat-window">
          {activeModule === 'flashcards' ? (
            <div className="flashcards-section">
              {flashcards.length === 0 ? (
                <div className="flashcards-empty glass" style={{ width: '100%', maxWidth: '800px' }}>
                  <BookOpen size={48} className="empty-icon" />
                  <h3>Selecciona el material de estudio</h3>
                  <p>Marcar los textos de los que quieres generar las tarjetas de memoria.</p>

                  <div className="doc-selector-grid">
                    {documents.length === 0 ? (
                      <p className="muted">No hay bibliografía cargada en la base de datos.</p>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.id}
                          className={`doc-selection-item glass ${selectedDocIds.includes(doc.id) ? 'selected' : ''}`}
                          onClick={() => toggleDocSelection(doc.id)}
                        >
                          <div className="selector-checkbox">
                            <div className="checkbox-inner"></div>
                          </div>
                          <div className="selection-info">
                            <span className="selection-name">{doc.metadata?.source || 'Documento sin nombre'}</span>
                            <span className="selection-date">{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    className="generate-btn glass"
                    onClick={handleGenerateFlashcards}
                    disabled={isLoading || selectedDocIds.length === 0}
                    style={{ marginTop: '1.5rem', width: '100%' }}
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : <Brain size={20} />}
                    {isLoading ? 'Extrayendo conceptos...' : `Generar de ${selectedDocIds.length} textos seleccionados`}
                  </button>
                </div>
              ) : (
                <div className="flashcard-container">
                  <div className="flashcard-nav">
                    <button className="back-to-selection" onClick={() => setFlashcards([])}><History size={16} /> Cambiar selección</button>
                    <span>Tarjeta {currentFlashcardIndex + 1} de {flashcards.length}</span>
                  </div>
                  <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
                    <div className="flashcard-inner">
                      <div className="flashcard-front glass">
                        <div className="card-label">PREGUNTA</div>
                        <p>{flashcards[currentFlashcardIndex].question}</p>
                        <div className="flip-hint">Click para ver respuesta</div>
                      </div>
                      <div className="flashcard-back glass">
                        <div className="card-label">RESPUESTA</div>
                        <p>{flashcards[currentFlashcardIndex].answer}</p>
                        <div className="flip-hint">Click para volver</div>
                      </div>
                    </div>
                  </div>
                  <div className="flashcard-controls">
                    <button
                      className="nav-btn glass"
                      onClick={(e) => { e.stopPropagation(); setCurrentFlashcardIndex(prev => Math.max(0, prev - 1)); setIsFlipped(false); }}
                      disabled={currentFlashcardIndex === 0}
                    >
                      Anterior
                    </button>
                    <button className="reset-btn glass" onClick={handleGenerateFlashcards} title="Regenerar con la misma selección">
                      <History size={18} />
                    </button>
                    <button
                      className="nav-btn glass active"
                      onClick={(e) => { e.stopPropagation(); setCurrentFlashcardIndex(prev => Math.min(flashcards.length - 1, prev + 1)); setIsFlipped(false); }}
                      disabled={currentFlashcardIndex === flashcards.length - 1}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="messages-container">
                {messages.filter(m => !m.module || m.module === activeModule).length === 0 && (
                  <div className="message assistant glass">
                    {activeModule === 'exam' ? (
                      <p>Bienvenido al módulo de <strong>Examen</strong>. Evaluaré tu integración clínica y teórica. ¿Empezamos?</p>
                    ) : (
                      <p>Hola. Estoy aquí para resolver tus <strong>dudas</strong> académicas. ¿En qué concepto quieres profundizar hoy?</p>
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
                  placeholder={activeModule === 'exam' ? "Escribe tu respuesta clínica/analítica..." : "Haz una pregunta sobre el material..."}
                  className="chat-input"
                />
                <button className="send-btn" onClick={handleSend} disabled={isLoading}><Send size={18} /></button>
              </div>
            </>
          )}
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
              <h4>Nivel de Integración</h4>
              <div className="level-badge">{lastEvaluation.level}</div>
            </div>
            <div className="metric-card">
              <h4>Calificación</h4>
              <div className="score-value">{lastEvaluation.score}/10</div>
            </div>
            {lastEvaluation.clinical_implications && (
              <div className="metric-card">
                <h4>Implicancia Clínica</h4>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.4', color: '#a1a1aa', marginTop: '0.5rem' }}>
                  {lastEvaluation.clinical_implications}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

export default App;
