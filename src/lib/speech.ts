export const speakTribunalMessage = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech to avoid overlapping
    window.speechSynthesis.cancel();

    // Create a clean version of the text for parsing (remove bolding that might trip regex)
    // But keep the brackets for segmenting
    const cleanForParsing = text.replace(/\*\*/g, '');

    const regex = /\[(.*?)\][:\s]*(.*?)(?=\[|$)/gs;
    let match;
    const segments: { professor: string, content: string }[] = [];

    while ((match = regex.exec(cleanForParsing)) !== null) {
        segments.push({
            professor: match[1].trim(),
            content: match[2].trim()
        });
    }

    // Fallback: If no tags found, speak the whole text but strip markdown first
    if (segments.length === 0) {
        const fallbackText = text.replace(/\*\*|#|_|`/g, '');
        const utterance = new SpeechSynthesisUtterance(fallbackText);
        utterance.lang = 'es-ES';
        window.speechSynthesis.speak(utterance);
        return;
    }

    // Get available voices
    const voices = window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.startsWith('es'));

    // Names of typical female voices in various OS
    const femaleVoiceNames = ['helena', 'laura', 'sabina', 'monica', 'paulina', 'lucia', 'google español', 'zira'];

    // Speak each segment
    segments.forEach((seg) => {
        // Strip markdown from content for cleaner speech
        const speechContent = seg.content.replace(/\*\*|#|_|`/g, '');
        if (!speechContent.trim()) return;

        const utterance = new SpeechSynthesisUtterance(speechContent);
        utterance.lang = 'es-ES';

        const profName = seg.professor.toLowerCase();

        // Find a male voice for everyone (not in the female list)
        const maleVoice = spanishVoices.find(v =>
            !femaleVoiceNames.some(name => v.name.toLowerCase().includes(name))
        );
        if (maleVoice) utterance.voice = maleVoice;

        if (profName.includes('castillo')) {
            utterance.pitch = 0.6;
            utterance.rate = 1.05; // Balanced
        } else if (profName.includes('varela')) {
            utterance.pitch = 0.9;
            utterance.rate = 1.15; // Balanced
        } else if (profName.includes('rossi')) {
            utterance.pitch = 1.2;
            utterance.rate = 1.2; // Much more intelligible
        }

        window.speechSynthesis.speak(utterance);
    });
};
