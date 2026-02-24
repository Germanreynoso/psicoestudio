import { useState, useEffect, useRef } from 'react';
import { Brain, GraduationCap, Send, History, Loader2, FileCheck, BookOpen, X, FileText, HelpCircle, Menu, Stethoscope, Mic, MicOff, Network, Maximize2, Minimize2 } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { generateAIResponse, getRelevantContext, evaluateResponse, generateFlashcards, getContextByIds, generateClinicalCase, generateKnowledgeGraph } from './lib/ai';
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
  const [activeModule, setActiveModule] = useState<'exam' | 'doubt' | 'flashcards' | 'cases' | 'map'>('exam');
  const [isCaseActive, setIsCaseActive] = useState(false);
  const [isExamActive, setIsExamActive] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: any[], edges: any[] } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [currentQuestionCount, setCurrentQuestionCount] = useState(0);
  const totalQuestionsLimit = 5;
  const recognitionRef = useRef<any>(null);
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
    if (activeModule === 'flashcards' || activeModule === 'cases' || activeModule === 'exam' || activeModule === 'map') {
      fetchAllDocsForSelection();
    }
  }, [activeModule]);

  const handleStartExam = async () => {
    if (selectedDocIds.length === 0) {
      alert("Por favor, selecciona al menos un texto bibliográfico para el examen.");
      return;
    }
    setIsLoading(true);
    try {
      const context = await getContextByIds(selectedDocIds);

      const session = await createNewSession();
      setSessionId(session.id);

      const firstQuestion = await generateAIResponse(context, [], 'exam');
      const introMessage = { role: 'assistant', content: firstQuestion, module: 'exam' };
      setMessages([introMessage]);
      await saveChatMessage(session.id, 'assistant', firstQuestion);
      setIsExamActive(true);
    } catch (error) {
      console.error('Error starting exam:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCase = async () => {
    if (selectedDocIds.length === 0) {
      alert("Por favor, selecciona al menos un texto bibliográfico para el caso.");
      return;
    }
    setIsLoading(true);
    try {
      const context = await getContextByIds(selectedDocIds);
      const caseIntro = await generateClinicalCase(context);

      const session = await createNewSession();
      setSessionId(session.id);

      const introMessage = { role: 'assistant', content: caseIntro, module: 'cases' };
      setMessages([introMessage]);
      await saveChatMessage(session.id, 'assistant', caseIntro);
      setIsCaseActive(true);
      setCurrentQuestionCount(1);
    } catch (error) {
      console.error('Error starting case:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleGenerateGraph = async () => {
    if (selectedDocIds.length === 0) {
      alert("Por favor, selecciona al menos un texto bibliográfico.");
      return;
    }
    setIsLoading(true);
    try {
      const context = await getContextByIds(selectedDocIds);
      const data = await generateKnowledgeGraph(context);

      // Enhanced circular layout logic for expanded view
      const radius = 380;
      const centerX = 500;
      const centerY = 450;

      const positionedNodes = data.nodes.map((node: any, i: number) => {
        const angle = (i / data.nodes.length) * 2 * Math.PI;
        return {
          ...node,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        };
      });

      setGraphData({ nodes: positionedNodes, edges: data.edges });
    } catch (error) {
      console.error('Error generating graph:', error);
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

  const handleVoiceToggle = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Tu navegador no soporta reconocimiento de voz.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInput(currentTranscript);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    try {
      const newMessages = [...messages, { role: 'user', content: userMessage, module: activeModule }];
      setMessages(newMessages);
      await saveChatMessage(sessionId, 'user', userMessage);

      const context = await getRelevantContext();
      let aiContent = "";
      let isMetaMessage = false;

      if (activeModule === 'exam') {
        const examContext = await getContextByIds(selectedDocIds);
        const isFirstStudentMessage = messages.filter(m => m.role === 'user' && m.module === 'exam').length === 0;
        const evaluation = await evaluateResponse(userMessage, examContext);

        isMetaMessage = evaluation.isMeta || isFirstStudentMessage;

        if (isMetaMessage) {
          aiContent = await generateAIResponse(examContext, newMessages, 'exam');
        } else {
          setLastEvaluation(evaluation);
          const nextQuestion = await generateAIResponse(examContext, newMessages, 'exam');
          aiContent = `**FEEDBACK DOCENTE:**\n${evaluation.feedback}\n\n---\n**CALIFICACIÓN:** ${evaluation.score}/10 | **NIVEL:** ${evaluation.level}\n---\n\n**SIGUIENTE PREGUNTA:**\n${nextQuestion}`;
          await saveChatMessage(sessionId, 'assistant', aiContent, evaluation);
        }
      } else if (activeModule === 'cases') {
        const caseContext = await getContextByIds(selectedDocIds);
        aiContent = await generateAIResponse(caseContext, newMessages, 'cases');
        await saveChatMessage(sessionId, 'assistant', aiContent);
      } else {
        aiContent = await generateAIResponse(context, newMessages, 'doubt');
        await saveChatMessage(sessionId, 'assistant', aiContent);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: aiContent, module: activeModule }]);

      if (!isMetaMessage && (activeModule === 'exam' || activeModule === 'cases')) {
        setCurrentQuestionCount(prev => prev + 1);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishSession = async () => {
    setIsLoading(true);
    try {
      const { generateFinalReport } = await import('./lib/ai');
      const context = await getContextByIds(selectedDocIds);
      const report = await generateFinalReport(context, messages);

      const finalMessage = {
        role: 'assistant',
        content: `### 🏁 INFORME FINAL DE LA SESIÓN\n\n${report}`,
        module: activeModule
      };

      setMessages(prev => [...prev, finalMessage]);
      setCurrentQuestionCount(totalQuestionsLimit);
    } catch (error) {
      console.error('Error generating report:', error);
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
          <div className={`nav-item ${activeModule === 'cases' ? 'active' : ''}`} onClick={() => { setActiveModule('cases'); setIsSidebarOpen(false); }}>
            <Stethoscope size={20} /><span>Casos Clínicos</span>
          </div>
          <div className={`nav-item ${activeModule === 'map' ? 'active' : ''}`} onClick={() => { setActiveModule('map'); setIsSidebarOpen(false); }}>
            <Network size={20} /><span>Mapa de Conceptos</span>
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
              <h1>{activeModule === 'exam' ? 'Examen Final' : activeModule === 'doubt' ? 'Consultas' : activeModule === 'cases' ? 'Casos Clínicos' : 'Flashcards'}</h1>
              <p className="subtitle">
                {(activeModule === 'exam' && isExamActive) || (activeModule === 'cases' && isCaseActive) ? (
                  <span className="progress-pill">Progreso: {currentQuestionCount} de {totalQuestionsLimit}</span>
                ) : (
                  activeModule === 'exam' ? 'Evaluación de Especialidad' : activeModule === 'doubt' ? 'Resolución de dudas' : 'Aprendizaje Acelerado'
                )}
              </p>
            </div>
          </div>
          <div className="module-tabs">
            <button className={`tab ${activeModule === 'exam' ? 'active' : ''}`} onClick={() => setActiveModule('exam')}>Examen</button>
            <button className={`tab ${activeModule === 'doubt' ? 'active' : ''}`} onClick={() => setActiveModule('doubt')}>Dudas</button>
            <button className={`tab ${activeModule === 'flashcards' ? 'active' : ''}`} onClick={() => setActiveModule('flashcards')}>Flashcards</button>
            <button className={`tab ${activeModule === 'cases' ? 'active' : ''}`} onClick={() => setActiveModule('cases')}>Casos</button>
            <button className={`tab ${activeModule === 'map' ? 'active' : ''}`} onClick={() => setActiveModule('map')}>Mapa</button>
          </div>
        </header>

        <section className="chat-window">
          {activeModule === 'map' ? (
            <div className="flashcards-section">
              {!graphData ? (
                <div className="flashcards-empty glass" style={{ width: '100%', maxWidth: '800px' }}>
                  <Network size={48} className="empty-icon" />
                  <h3>Generar Mapa de Conceptos</h3>
                  <p>La IA analizará los textos para crear una red visual de términos y sus relaciones.</p>

                  <div className="doc-selector-grid">
                    {documents.map((doc) => (
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
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="generate-btn glass"
                    onClick={handleGenerateGraph}
                    disabled={isLoading || selectedDocIds.length === 0}
                    style={{ marginTop: '1.5rem', width: '100%' }}
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : <Network size={20} />}
                    {isLoading ? 'Tejiendo conexiones...' : `Generar Mapa de ${selectedDocIds.length} textos`}
                  </button>
                </div>
              ) : (
                <div className={`graph-container glass ${isGraphFullscreen ? 'fullscreen' : ''}`}>
                  <div className="graph-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <h3>Red de Conceptos Integrados</h3>
                      <span className="edge-count-badge">{graphData.edges.length} Conexiones</span>
                      {isGraphFullscreen && <span className="fullscreen-badge">Pantalla Completa Activa</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="back-btn-mini" onClick={() => setIsGraphFullscreen(!isGraphFullscreen)}>
                        {isGraphFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        {isGraphFullscreen ? 'Salir' : 'Expandir'}
                      </button>
                      <button className="back-btn-mini" onClick={() => { setGraphData(null); setSelectedEdge(null); }}><History size={14} /> Nueva Red</button>
                    </div>
                  </div>
                  <div className="graph-main-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <div className="graph-viewport" style={{ flex: 1 }}>
                      <svg width="100%" height="100%" viewBox="0 0 1000 900" preserveAspectRatio="xMidYMid meet">
                        <defs>
                          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="45" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.3)" />
                          </marker>
                        </defs>
                        {/* Lines first */}
                        {graphData.edges.map((edge, i) => {
                          const fromNode = graphData.nodes.find(n => n.id === edge.from);
                          const toNode = graphData.nodes.find(n => n.id === edge.to);
                          if (!fromNode || !toNode) return null;
                          return (
                            <g
                              key={i}
                              className={`graph-edge-group ${selectedEdge === edge ? 'selected' : ''}`}
                              onClick={() => setSelectedEdge(edge)}
                              style={{ cursor: 'pointer' }}
                            >
                              <line
                                x1={fromNode.x} y1={fromNode.y}
                                x2={toNode.x} y2={toNode.y}
                                className="graph-edge-line"
                                markerEnd="url(#arrowhead)"
                              />
                              <rect
                                x={(fromNode.x + toNode.x) / 2 - 50}
                                y={(fromNode.y + toNode.y) / 2 - 15}
                                width="100" height="30" rx="15"
                                className="edge-label-bg"
                              />
                              <text
                                x={(fromNode.x + toNode.x) / 2}
                                y={(fromNode.y + toNode.y) / 2 + 5}
                                className="edge-label"
                                textAnchor="middle"
                              >
                                {edge.label}
                              </text>
                            </g>
                          );
                        })}
                        {/* Nodes second - Larger for readability */}
                        {graphData.nodes.map((node) => (
                          <g key={node.id} className="graph-node-group">
                            <circle
                              cx={node.x} cy={node.y} r="65"
                              className={`graph-node ${node.type?.toLowerCase()}`}
                            />
                            <text
                              x={node.x} y={node.y + 5}
                              className="node-label"
                              textAnchor="middle"
                            >
                              {node.label}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>

                    {/* Relationship Detail Panel */}
                    <div className={`graph-detail-panel glass ${selectedEdge ? 'open' : ''}`}>
                      {selectedEdge ? (
                        <>
                          <div className="panel-header">
                            <h4>📍 Detalle de Conexión</h4>
                            <button className="close-panel-btn" onClick={() => setSelectedEdge(null)}><X size={16} /></button>
                          </div>
                          <div className="panel-content">
                            <div className="connection-summary">
                              <div className="concept-pill">{graphData.nodes.find(n => n.id === selectedEdge.from)?.label}</div>
                              <div className="relation-arrow">¿Por qué se vinculan?</div>
                              <div className="concept-pill">{graphData.nodes.find(n => n.id === selectedEdge.to)?.label}</div>
                            </div>
                            <div className="justification-box">
                              <p>{selectedEdge.justification || "Esta relación indica una vinculación directa analizada por la IA en tu bibliografía."}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="panel-empty">
                          <Network size={32} />
                          <p>Toca una conexión para ver la explicación del Catedrático</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeModule === 'exam' && !isExamActive ? (
            <div className="flashcards-section">
              <div className="flashcards-empty glass" style={{ width: '100%', maxWidth: '800px' }}>
                <GraduationCap size={48} className="empty-icon" />
                <h3>Configurar Examen Final</h3>
                <p>Selecciona los textos que el Catedrático evaluará en esta mesa de examen.</p>

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
                  onClick={handleStartExam}
                  disabled={isLoading || selectedDocIds.length === 0}
                  style={{ marginTop: '1.5rem', width: '100%' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <GraduationCap size={20} />}
                  {isLoading ? 'Asignando bibliografía...' : `Comenzar Examen de ${selectedDocIds.length} textos`}
                </button>
              </div>
            </div>
          ) : activeModule === 'cases' && !isCaseActive ? (
            <div className="flashcards-section">
              <div className="flashcards-empty glass" style={{ width: '100%', maxWidth: '800px' }}>
                <Stethoscope size={48} className="empty-icon" />
                <h3>Preparar Simulación Clínica</h3>
                <p>Selecciona los textos bibliográficos en los que se debe basar el caso del paciente.</p>

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
                  onClick={handleStartCase}
                  disabled={isLoading || selectedDocIds.length === 0}
                  style={{ marginTop: '1.5rem', width: '100%' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <Stethoscope size={20} />}
                  {isLoading ? 'Construyendo escenario...' : `Iniciar Caso de ${selectedDocIds.length} textos`}
                </button>
              </div>
            </div>
          ) : activeModule === 'flashcards' ? (
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
                {activeModule === 'cases' && isCaseActive && (
                  <button className="back-to-selection" onClick={() => setIsCaseActive(false)} style={{ marginBottom: '1rem' }}>
                    <History size={16} /> Nuevo Caso / Cambiar selección
                  </button>
                )}
                {activeModule === 'exam' && isExamActive && (
                  <button className="back-to-selection" onClick={() => { setIsExamActive(false); setMessages([]); }} style={{ marginBottom: '1rem' }}>
                    <History size={16} /> Mesa de examen nueva / Cambiar bibliografía
                  </button>
                )}
                {((activeModule === 'exam' && isExamActive) || (activeModule === 'cases' && isCaseActive)) && currentQuestionCount < totalQuestionsLimit && (
                  <button
                    className="finish-session-btn glass"
                    onClick={handleFinishSession}
                    disabled={isLoading}
                  >
                    <FileCheck size={16} /> Entregar y recibir devolución final
                  </button>
                )}
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
                {isListening && (
                  <div className="listening-overlay">
                    <div className="pulse-dot"></div>
                    Escuchando su respuesta...
                  </div>
                )}
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
                  placeholder={
                    activeModule === 'exam' ? "Escribe tu respuesta clínica/analítica..." :
                      activeModule === 'cases' ? "Pregunta al paciente o propone una acción..." :
                        "Haz una pregunta sobre el material..."
                  }
                  className="chat-input"
                />
                <div className="input-actions-group">
                  <button
                    className={`voice-btn ${isListening ? 'listening' : ''}`}
                    onClick={handleVoiceToggle}
                    title={isListening ? "Detener micrófono" : "Hablar (Modo Oral)"}
                  >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <button className="send-btn" onClick={handleSend} disabled={isLoading}><Send size={18} /></button>
                </div>
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
