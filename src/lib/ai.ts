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

export const generateAIResponse = async (context: string, history: any[], mode: 'exam' | 'doubt') => {
    const prompts = {
        exam: `
      Eres un Profesor Universitario de Élite.
      MODO: SIMULACIÓN DE EXAMEN EXIGENTE.
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Genera UNA pregunta analítica profunda.
      2. No expliques conceptos aquí, solo evalúa y pregunta.
      3. Si el alumno acaba de empezar, lanza el primer cruce teórico.
    `,
        doubt: `
      Eres un Mentor Académico.
      MODO: RESOLUCIÓN DE DUDAS Y EXPLICACIÓN PEDAGÓGICA.
      BIBLIOGRAFÍA: ${context}
      HISTORIAL: ${JSON.stringify(history)}

      INSTRUCCIONES:
      1. Explica los conceptos que el alumno no entienda de forma clara y didáctica.
      2. Usa ejemplos clínicos o teóricos.
      3. Mantén el rigor académico pero sé accesible.
    `
    };

    const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompts[mode] }],
        model: 'llama-3.3-70b-versatile',
    });

    return completion.choices[0]?.message?.content || "Error en la conexión docente.";
};

export const evaluateResponse = async (userResponse: string, context: string) => {
    // Solo evaluamos si la respuesta parece académica y no es un saludo corto
    if (userResponse.length < 15) {
        return { isMeta: true };
    }

    const prompt = `
    Evalúa esta respuesta de examen.
    CONCEPTO: ${context}
    RESPUESTA: "${userResponse}"
    
    JSON:
    {
      "score": 1-10,
      "level": "Repetición Literal" | "Comprensión Básica" | "Integración Conceptual" | "Pensamiento Crítico",
      "feedback": "Análisis docente",
      "clinical_implications": "Cruces con la clínica"
    }
  `;

    const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' }
    });

    return JSON.parse(completion.choices[0]?.message?.content || '{}');
};
