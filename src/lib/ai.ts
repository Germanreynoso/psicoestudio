import Groq from 'groq-sdk';
import { supabase } from './supabase';

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

export const saveManualContext = async (text: string) => {
  const { error } = await supabase.from('documents').insert([
    { content: text, metadata: { source: 'Entrada manual', timestamp: new Date().toISOString() } }
  ]);
  return !error;
};

export const getRelevantContext = async (): Promise<string> => {
  const { data, error } = await supabase
    .from('documents')
    .select('content, metadata')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!error && data && data.length > 0) {
    return data.map(doc => {
      if (doc.metadata?.type === 'pdf_reference') {
        return `[ARCHIVO CARGADO: ${doc.metadata.source}. El alumno lo ha subido a Supabase para su evaluación.]`;
      }
      return doc.content;
    }).join('\n\n');
  }
  return "No hay material cargado aún.";
};

export const getContextByIds = async (ids: string[]): Promise<string> => {
  if (ids.length === 0) return await getRelevantContext();

  const { data, error } = await supabase
    .from('documents')
    .select('content')
    .in('id', ids);

  if (!error && data && data.length > 0) {
    return data.map(doc => doc.content).join('\n\n');
  }
  return "No se encontró el material seleccionado.";
};

export const generateAIResponse = async (context: string, history: any[], mode: 'exam' | 'doubt' | 'cases' | 'tribunal') => {
  const prompts = {
    exam: `
      Eres un Catedrático de Facultad de Medicina y Psicología de alto nivel.
      MODO: SIMULACIÓN DE EXAMEN INTEGRADOR Y EXIGENTE.
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Genera UNA pregunta que exija pensamiento clínico o integración teórica (Anatomía, Fisiología, Psicopatología, Clínica, etc).
      2. No expliques conceptos aquí, solo evalúa y pregunta.
      3. Si el alumno acaba de empezar, lanza el primer cruce teórico o caso clínico breve.
    `,
    doubt: `
      Eres un Mentor Académico Especializado.
      MODO: RESOLUCIÓN DE DUDAS Y EXPLICACIÓN PEDAGÓGICA (Medicina/Psicología).
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Explica los conceptos complejos de forma clara, usando analogías médicas o clínicas si es necesario.
      2. Usa ejemplos de la práctica profesional.
      3. Mantén el rigor científico.
    `,
    cases: `
      Eres un Supervisor Clínico y el Paciente (Simulación Mixta).
      MODO: RESOLUCIÓN DE CASO CLÍNICO INTERACTIVO.
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Si el alumno hace una pregunta al paciente, responde EN CARÁCTER (como el paciente).
      2. Si el alumno pide un estudio o da un diagnóstico, responde como SUPERVISOR evaluando la pertinencia.
      3. El objetivo es que el alumno llegue al diagnóstico o tratamiento correcto basándose exclusivamente en la bibliografía.
      4. Mantén el caso dinámico. No des la respuesta, deja que el alumno investigue (anamnesis).
    `,
    tribunal: `
      Eres una MESA DE EXAMEN (Tribunal) compuesta por 3 profesores con personalidades marcadas y contrastantes:
      1. PROFESOR CRUEL Y EXIGENTE (Dr. Castillo): Es el terror de la facultad. Su tono es cínico, impaciente y hostil. No tolera "guitarreo" ni dudas. Si el alumno falla, lanza comentarios mordaces sobre su falta de preparación. Su objetivo es poner al alumno bajo una presión psicológica extrema, cuestionando su idoneidad para la carrera. Exige citas textuales y rigor absoluto.
      2. PROFESOR CLÍNICO (Dr. Varela): Se enfoca en la praxis. Es serio y profesional, pero se desespera si el alumno no ve lo obvio en un paciente. Evalúa si el alumno tiene "ojos para la clínica".
      3. PROFESOR EMPÁTICO (Lic. Rossi): Es el único aliado del alumno. Intenta mediar cuando Castillo es demasiado cruel, traduce las preguntas difíciles a un lenguaje más comprensible y anima al alumno a seguir, aunque con suavidad.

      BIBLIOGRAFÍA DE REFERENCIA: ${context}
      HISTORIAL DE LA SESIÓN: ${JSON.stringify(history)}

      INSTRUCCIONES DE INTERACCIÓN:
      - Responde como la MESA en conjunto. Los profesores deben dialogar entre sí.
      - **Conflicto en la mesa**: Castillo debe interrumpir con sarcasmo si Rossi ayuda demasiado o si el alumno duda.
      - **Respuesta a preguntas**: Si el alumno pregunta algo "obvio", Castillo debe humillarlo antes de que Rossi explique con paciencia.
      - Usa un formato claro: **[Dr. Castillo]**, **[Dr. Varela]**, **[Lic. Rossi]**.
      - Mantén el alto nivel académico bajo un clima de tensión real de examen final oral.
    `
  };

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompts[mode] }],
    model: 'llama-3.3-70b-versatile',
  });

  return completion.choices[0]?.message?.content || "Error en la conexión docente.";
};

export const generateClinicalCase = async (context: string) => {
  const prompt = `
    Basándote en la siguiente bibliografía, genera un CASO CLÍNICO inicial breve para que un estudiante lo resuelva.
    No des el diagnóstico. Presenta el motivo de consulta y los signos vitales/datos iniciales básicos.
    El caso debe ser desafiante y requerir integración de los textos provistos.
    
    BIBLIOGRAFÍA: ${context.substring(0, 5000)}
    
    Responde en formato texto natural, presentándote como el supervisor que introduce el caso.
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
  });

  return completion.choices[0]?.message?.content || "No se pudo generar el caso clínico.";
};

export const evaluateResponse = async (userResponse: string, context: string) => {
  if (userResponse.length < 10) {
    return { isMeta: true };
  }

  const prompt = `
    Analiza si el siguiente mensaje de un alumno es una RESPUESTA a un examen o si es solo un COMENTARIO inicial/pregunta administrativa (ej: "empecemos", "cómo funciona", "registra esto").
    
    MENSAJE: "${userResponse}"
    CONTEXTO DISPOBILBLE: ${context.substring(0, 1000)}

    Si el mensaje NO es una respuesta técnica a un concepto médico/psicológico, marca "isMeta": true.
    Si el mensaje ES un intento de responder una pregunta de examen, evalúalo proporcionalmente.
    
    JSON:
    {
      "isMeta": boolean,
      "score": 1-10,
      "level": "Repetición Literal" | "Comprensión Básica" | "Integración Conceptual" | "Pensamiento Crítico/Clínico",
      "feedback": "Análisis docente detallado",
      "clinical_implications": "Cruces con la práctica clínica real"
    }
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' }
  });

  return JSON.parse(completion.choices[0]?.message?.content || '{ "isMeta": true }');
};

export const generateFinalReport = async (context: string, history: any[]) => {
  const prompt = `
    Eres el Catedrático Titular y Supervisor Clínico. Has finalizado la mesa de examen/caso clínico con el alumno.
    
    BIBLIOGRAFÍA DE REFERENCIA: ${context.substring(0, 3000)}
    HISTORIAL COMPLETO DE LA SESIÓN: ${JSON.stringify(history)}
    
    INSTRUCCIONES:
    1. Realiza una EVALUACIÓN GLOBAL del desempeño del alumno.
    2. Menciona puntos fuertes y debilidades específicas (temas que no supo responder).
    3. Asigna una CALIFICACIÓN FINAL (1-10) justificada.
    4. Proporciona una "Hoja de Ruta de Repaso": ¿Qué capítulos o conceptos debe releer según sus errores?
    5. Usa un tono académico, firme pero constructivo.
    
    FORMATO: Usa Markdown para una presentación premium (negritas, listas, etc).
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
  });

  return completion.choices[0]?.message?.content || "No se pudo generar el reporte final.";
};

export const generateKnowledgeGraph = async (context: string) => {
  const prompt = `
    Analiza el siguiente material de estudio y extrae un MAPA CONCEPTUAL (Knowledge Graph).
    Identifica los 8-12 conceptos o entidades más importantes y cómo se relacionan entre sí.
    CRÍTICO: Para cada relación (edge), proporciona una breve explicación técnica de POR QUÉ se relacionan basada en el texto.
    
    MATERIAL: ${context.substring(0, 5000)}
    
    JSON format:
    {
      "nodes": [
        { "id": "1", "label": "Concepto A", "type": "Teoría|Autor|Síntoma|Proceso" },
        ...
      ],
      "edges": [
        { "from": "1", "to": "2", "label": "Relación (verbo)", "justification": "Explicación detallada de la conexión..." },
        ...
      ]
    }
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' }
  });

  return JSON.parse(completion.choices[0]?.message?.content || '{ "nodes": [], "edges": [] }');
};

export const generateFlashcards = async (context: string) => {
  const prompt = `
    Basándote en el siguiente material de estudio, genera un conjunto de 5-8 flashcards (tarjetas de memoria).
    Cada tarjeta debe tener una PREGUNTA directa y una RESPUESTA concisa.
    Enfócate en conceptos clave, valores normales, autores, o mecanismos fisiopatológicos.
    
    MATERIAL: ${context.substring(0, 4000)}
    
    JSON format:
    {
      "flashcards": [
        { "question": "...", "answer": "..." },
        ...
      ]
    }
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' }
  });

  return JSON.parse(completion.choices[0]?.message?.content || '{ "flashcards": [] }');
};
