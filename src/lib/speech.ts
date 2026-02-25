let onStateChange: (playing: boolean) => void = () => { };

export const setSpeechStateCallback = (callback: (playing: boolean) => void) => {
    onStateChange = callback;
};

export const speakTribunalMessage = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    isPlaying = false;
    currentIndex = 0;
    onStateChange(false);

    const cleanForParsing = text.replace(/\*\*/g, '');
    const regex = /\[(.*?)\][:\s]*(.*?)(?=\[|$)/gs;
    let match;
    currentSegments = [];

    while ((match = regex.exec(cleanForParsing)) !== null) {
        currentSegments.push({
            speaker: match[1].trim(),
            content: match[2].trim()
        });
    }

    if (currentSegments.length === 0) {
        currentSegments = [{ speaker: 'Narrador', content: text }];
    }

    playSegment(0);
};

// Store segments and current index for granular control
let currentSegments: { speaker: string, content: string }[] = [];
let currentIndex = 0;
let isPlaying = false;

export const pauseSpeech = () => {
    window.speechSynthesis.pause();
    isPlaying = false;
    onStateChange(false);
};

export const resumeSpeech = () => {
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        isPlaying = true;
        onStateChange(true);
    } else {
        playSegment(currentIndex);
    }
};

export const stopSpeech = () => {
    window.speechSynthesis.cancel();
    currentIndex = 0;
    isPlaying = false;
    onStateChange(false);
};

export const nextSegment = () => {
    if (currentIndex < currentSegments.length - 1) {
        window.speechSynthesis.cancel();
        playSegment(currentIndex + 1);
    }
};

export const prevSegment = () => {
    if (currentIndex > 0) {
        window.speechSynthesis.cancel();
        playSegment(currentIndex - 1);
    }
};

const playSegment = (index: number) => {
    if (index < 0 || index >= currentSegments.length) {
        isPlaying = false;
        onStateChange(false);
        return;
    }

    currentIndex = index;
    isPlaying = true;
    onStateChange(true);
    const seg = currentSegments[index];
    const speechContent = seg.content.replace(/\*\*|#|_|`/g, '');

    if (!speechContent.trim()) {
        playSegment(index + 1);
        return;
    }

    const utterance = new SpeechSynthesisUtterance(speechContent);
    utterance.lang = 'es-ES';

    const voices = window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
    const femaleVoiceNames = ['helena', 'laura', 'sabina', 'monica', 'paulina', 'lucia', 'google español', 'zira'];

    const maleVoice = spanishVoices.find(v => !femaleVoiceNames.some(name => v.name.toLowerCase().includes(name))) || null;
    const femaleVoice = spanishVoices.find(v => femaleVoiceNames.some(name => v.name.toLowerCase().includes(name))) || null;

    const name = seg.speaker.toLowerCase();

    if (name.includes('alex')) {
        utterance.voice = maleVoice;
        utterance.pitch = 1.35; // Diferencia más marcada
        utterance.rate = 1.2;
    } else if (name.includes('sam')) {
        utterance.voice = femaleVoice || maleVoice;
        utterance.pitch = 0.75; // Diferencia más marcada
        utterance.rate = 0.95;
    } else if (name.includes('castillo')) {
        utterance.voice = maleVoice;
        utterance.pitch = 0.6;
        utterance.rate = 1.0;
    } else if (name.includes('varela')) {
        utterance.voice = maleVoice;
        utterance.pitch = 0.9;
        utterance.rate = 1.1;
    } else if (name.includes('rossi')) {
        utterance.voice = femaleVoice || maleVoice;
        utterance.pitch = 1.2;
        utterance.rate = 1.15;
    } else {
        const isLikelyFemale = femaleVoiceNames.some(vname => name.includes(vname));
        utterance.voice = isLikelyFemale ? (femaleVoice || maleVoice) : (maleVoice || femaleVoice);
        const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        utterance.pitch = 0.8 + (hash % 6) * 0.1;
        utterance.rate = 1.1;
    }

    utterance.onend = () => {
        if (isPlaying && currentIndex === index) {
            playSegment(index + 1);
        }
    };

    window.speechSynthesis.speak(utterance);
};

