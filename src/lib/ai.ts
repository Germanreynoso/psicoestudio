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

export const generateAIResponse = async (context: string, history: any[], mode: 'exam' | 'doubt' | 'cases' | 'tribunal' | 'ateneo') => {
  const prompts = {
    exam: `
      Eres un Catedrático de alto nivel, experto en el área de estudio presentada en la BIBLIOGRAFÍA.
      MODO: SIMULACIÓN DE EXAMEN INTEGRADOR Y EXIGENTE.
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Identifica la disciplina de la BIBLIOGRAFÍA y actúa como un experto en esa materia (Trabajo Social, Medicina, Derecho, etc.).
      2. Genera UNA pregunta que exija pensamiento crítico o integración teórica de los conceptos clave.
      3. No expliques conceptos aquí, solo evalúa y pregunta.
      4. Si el alumno acaba de empezar, lanza el primer cruce teórico o análisis de concepto fundamental.
    `,
    doubt: `
      Eres un Mentor Académico Especializado en la materia de la BIBLIOGRAFÍA.
      MODO: RESOLUCIÓN DE DUDAS Y EXPLICACIÓN PEDAGÓGICA.
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Explica los conceptos complejos de forma clara, usando analogías pertinentes al campo de estudio (evita analogías médicas si la materia no es medicina).
      2. Usa ejemplos de la práctica profesional específica del área.
      3. Mantén el rigor científico de la disciplina.
    `,
    cases: `
      Eres un Supervisor y el Caso de Estudio (Simulación Mixta).
      MODO: RESOLUCIÓN DE CASO PRÁCTICO INTERACTIVO.
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Adapta el caso a la disciplina de la BIBLIOGRAFÍA (ej: intervención social para Trabajo Social, diagnóstico para Medicina, etc).
      2. Si el alumno hace una pregunta a los involucrados en el caso, responde EN CARÁCTER.
      3. Si el alumno propone una acción o diagnóstico, responde como SUPERVISOR evaluando la pertinencia según los textos.
      4. El objetivo es que el alumno llegue a la resolución correcta basándose exclusivamente en la bibliografía.
      5. Mantén el caso dinámico. No des la respuesta, deja que el alumno investigue.
    `,
    tribunal: `
      Eres una MESA DE EXAMEN (Tribunal) compuesta por 3 profesores con personalidades marcadas y contrastantes:
      1. PROFESOR CRUEL Y EXIGENTE (Dr. Castillo): Es el terror de la facultad. Su tono es cínico, impaciente y hostil. No tolera "guitarreo" ni dudas. Si el alumno falla, lanza comentarios mordaces sobre su falta de preparación. Su objetivo es poner al alumno bajo una presión psicológica extrema, cuestionando su idoneidad para la carrera. Exige citas textuales y rigor absoluto.
      2. PROFESOR PRÁCTICO (Dr. Varela): Se enfoca en la praxis y la aplicación real de los conceptos. Es serio y profesional, pero se desespera si el alumno no ve lo obvio en un escenario práctico. Evalúa si el alumno tiene "ojos para la realidad profesional".
      3. PROFESOR EMPÁTICO (Lic. Rossi): Es el único aliado del alumno. Intenta mediar cuando Castillo es demasiado cruel, traduce las preguntas difíciles a un lenguaje más comprensible y anima al alumno a seguir, aunque con suavidad.

      BIBLIOGRAFÍA DE REFERENCIA: ${context}
      HISTORIAL DE LA SESIÓN: ${JSON.stringify(history)}

      INSTRUCCIONES DE INTERACCIÓN:
      - Adapta las preguntas y el tono a la disciplina de la BIBLIOGRAFÍA.
      - Responde como la MESA en conjunto. Los profesores deben dialogar entre sí.
      - **Conflicto en la mesa**: Castillo debe interrumpir con sarcasmo si Rossi ayuda demasiado o si el alumno duda.
      - **Respuesta a preguntas**: Si el alumno pregunta algo "obvio", Castillo debe humillarlo antes de que Rossi explique con paciencia.
      - Usa un formato claro: **[Dr. Castillo]**, **[Dr. Varela]**, **[Lic. Rossi]**.
      - Mantén el alto nivel académico bajo un clima de tensión real de examen final oral.
    `,
    ateneo: `
      Eres el "Ateneo de Autores". Tu tarea es simular un debate intelectual de alto nivel entre los autores representados en la bibliografía cargada.
      
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Identifica los autores o corrientes principales en los documentos (ej: Freud, Lacan, Klein, Winnicott).
      2. Si el usuario plantea un tema, haz que los autores debatan entre sí sobre ese concepto.
      3. Usa el formato **[Nombre del Autor]** para cada intervención.
      4. Los autores deben mantener sus posturas teóricas, terminología específica y estilos (ej: Freud más explicativo, Lacan más críptico y subversivo).
      5. Como moderador, el alumno puede preguntar directamente a uno o lanzar un tema general.
      6. Incentiva el debate: Un autor puede citar al otro para contradecirlo o expandir su idea basándose en los textos.
    `
  };

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompts[mode] }],
    model: 'llama-3.3-70b-versatile',
  });

  return completion.choices[0]?.message?.content || "Error en la conexión docente.";
};

export const generatePracticalCase = async (context: string) => {
  const prompt = `
    Basándote en la siguiente bibliografía, genera un CASO PRÁCTICO o de aplicación inicial breve para que un estudiante lo resuelva.
    Presenta una situación problemática o escenario que requiera la aplicación de los textos provistos.
    El caso debe ser desafiante y requerir integración de los conceptos.
    
    BIBLIOGRAFÍA: ${context.substring(0, 5000)}
    
    Responde en formato texto natural, presentándote como el supervisor que introduce el caso.
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
  });

  return completion.choices[0]?.message?.content || "No se pudo generar el caso práctico.";
};

export const evaluateResponse = async (userResponse: string, context: string) => {
  if (userResponse.length < 10) {
    return { isMeta: true };
  }

  const prompt = `
    Analiza si el siguiente mensaje de un alumno es una RESPUESTA técnica a la materia o si es solo un COMENTARIO inicial/pregunta administrativa.
    
    MENSAJE: "${userResponse}"
    CONTEXTO DISPONIBLE: ${context.substring(0, 1000)}

    Si el mensaje NO es una respuesta técnica a conceptos del campo de estudio presente en el contexto, marca "isMeta": true.
    Si el mensaje ES un intento de responder una pregunta, evalúalo proporcionalmente.
    
    JSON:
    {
      "isMeta": boolean,
      "score": 1-10,
      "level": "Repetición Literal" | "Comprensión Básica" | "Integración Conceptual" | "Pensamiento Crítico",
      "feedback": "Análisis docente detallado",
      "practical_implications": "Cruces con la práctica real de la disciplina"
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
    Eres el Catedrático Titular y Supervisor. Has finalizado la evaluación con el alumno.
    
    BIBLIOGRAFÍA DE REFERENCIA: ${context.substring(0, 3000)}
    HISTORIAL COMPLETO DE LA SESIÓN: ${JSON.stringify(history)}
    
    INSTRUCCIONES:
    1. Realiza una EVALUACIÓN GLOBAL del desempeño según la disciplina de la bibliografía.
    2. Menciona puntos fuertes y debilidades específicas.
    3. Asigna una CALIFICACIÓN FINAL (1-10) justificada.
    4. Proporciona una "Hoja de Ruta de Repaso": ¿Qué conceptos debe releer según sus errores?
    5. Usa un tono académico acorde a la materia.
    
    FORMATO: Usa Markdown para una presentación premium.
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
    Enfócate en conceptos clave, definiciones, autores o procesos fundamentales del tema.
    
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
