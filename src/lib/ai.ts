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

export const generateAIResponse = async (context: string, history: any[], mode: 'exam' | 'doubt') => {
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
    `
    };

    const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompts[mode] }],
        model: 'llama-3.3-70b-versatile',
    });

    return completion.choices[0]?.message?.content || "Error en la conexión docente.";
};

export const evaluateResponse = async (userResponse: string, context: string) => {
    if (userResponse.length < 15) {
        return { isMeta: true };
    }

    const prompt = `
    Evalúa esta respuesta de examen de nivel universitario (Medicina/Psicología).
    CONCEPTO: ${context}
    RESPUESTA: "${userResponse}"
    
    Analiza: precisión terminológica, capacidad de síntesis y razonamiento clínico.
    
    JSON:
    {
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

    return JSON.parse(completion.choices[0]?.message?.content || '{}');
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
