import * as pdfjsLib from 'pdfjs-dist';

// Usar una versión antigua y ultra-estable (3.x) que no usa módulos mjs problemáticos
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
        });

        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // En la versión 3.x, textContent.items tiene una estructura ligeramente diferente
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n';
        }

        return fullText;
    } catch (error) {
        console.error('Error profundo en PDF:', error);
        throw error;
    }
};

export const chunkText = (text: string, chunkSize: number = 1000): string[] => {
    if (!text) return [];

    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    words.forEach(word => {
        currentChunk.push(word);
        currentLength += word.length + 1;
        if (currentLength >= chunkSize) {
            chunks.push(currentChunk.join(' '));
            currentChunk = currentChunk.slice(-20);
            currentLength = currentChunk.join(' ').length;
        }
    });

    if (currentChunk.length > 20) {
        chunks.push(currentChunk.join(' '));
    }

    return chunks;
};
