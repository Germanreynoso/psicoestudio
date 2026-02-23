import { supabase } from '../lib/supabase';

export const uploadStudyMaterial = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `pdfs/${fileName}`;

    const { data, error } = await supabase.storage
        .from('study-material')
        .upload(filePath, file);

    if (error) throw error;
    return data;
};

export const saveChatMessage = async (sessionId: string, role: 'user' | 'assistant', content: string, evaluation?: any) => {
    const { data, error } = await supabase
        .from('messages')
        .insert([{ session_id: sessionId, role, content, evaluation }])
        .select();

    if (error) throw error;
    return data[0];
};

export const createNewSession = async (userId?: string) => {
    const { data, error } = await supabase
        .from('exam_sessions')
        .insert([{ user_id: userId }])
        .select();

    if (error) throw error;
    return data[0];
};
