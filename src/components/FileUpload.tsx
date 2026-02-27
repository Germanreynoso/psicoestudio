import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, Loader2, X } from 'lucide-react';
import { uploadStudyMaterial } from '../services/api';
import { supabase } from '../lib/supabase';

interface FileUploadProps {
    onUploadSuccess: (fileName: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {

    const [files, setFiles] = useState<{ name: string; status: 'uploading' | 'success' | 'error' }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles) return;

        for (const file of Array.from(selectedFiles)) {
            // Limpiar estados previos si se reintenta
            setFiles(prev => [...prev.filter(f => f.name !== file.name), { name: file.name, status: 'uploading' }]);


            try {
                console.log('Iniciando proceso para:', file.name);
                setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'uploading' } : f));

                // 1. Subir al Storage (Esto ya funcionaba con check verde)
                await uploadStudyMaterial(file);

                // 2. Extraer texto real del PDF
                const { extractTextFromPDF } = await import('../lib/pdfProcessor');
                const extractedText = await extractTextFromPDF(file);

                // 3. Registrar en la base de datos con el contenido real
                await supabase.from('documents').insert([{
                    content: extractedText,
                    metadata: { source: file.name, type: 'pdf_text' }
                }]);

                setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'success' } : f));
                onUploadSuccess(file.name);
            } catch (error) {
                console.error('Error en carga:', error);
                setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f));
            }
        }

    };

    return (
        <div className="file-upload-container glass">
            <div
                className="drop-zone"
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="upload-icon" size={32} />
                <p>Subir Bibliografía a Supabase</p>
                <span className="hint">Los archivos se guardarán para análisis</span>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    accept=".pdf"
                    hidden
                />
            </div>

            {files.length > 0 && (
                <div className="file-list">
                    {files.map((file, index) => (
                        <div key={index} className="file-item">
                            <FileText size={18} />
                            <span className="file-name">{file.name}</span>
                            {file.status === 'uploading' && <Loader2 className="animate-spin" size={16} />}
                            {file.status === 'success' && <CheckCircle2 size={16} color="#10b981" />}
                            {file.status === 'error' && <X size={16} color="#ef4444" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
