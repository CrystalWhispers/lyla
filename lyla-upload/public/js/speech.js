const synth = window.speechSynthesis;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const canSpeak = Boolean(synth);
export const canListen = Boolean(Recognition);

let voices = [];
function loadVoices() {
  voices = (synth?.getVoices() || []).filter((v) => /^fr/i.test(v.lang));
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}
export function frenchVoices() {
  if (!voices.length) loadVoices();
  return voices;
}

let token = 0;
export function stop() {
  token++;
  synth?.cancel();
}

// Lit une liste de phrases à la suite. onPart(i) à chaque début de phrase, onEnd() à la fin.
export function speakQueue(parts, { rate = 0.95, voice = '', onPart, onEnd } = {}) {
  if (!synth || !parts.length) return false;
  stop();
  const mine = token;
  let i = 0;
  const pick = () => frenchVoices().find((v) => v.name === voice) || frenchVoices().find((v) => /fr[-_]FR/i.test(v.lang)) || frenchVoices()[0];
  const next = () => {
    if (mine !== token) return;
    if (i >= parts.length) {
      onEnd?.();
      return;
    }
    const idx = i++;
    const u = new SpeechSynthesisUtterance(parts[idx]);
    u.lang = 'fr-FR';
    u.rate = rate;
    const v = pick();
    if (v) u.voice = v;
    u.onstart = () => onPart?.(idx);
    u.onend = next;
    u.onerror = () => {
      if (mine === token) next();
    };
    synth.speak(u);
  };
  setTimeout(next, 40);
  return true;
}

export const speak = (text, opts) => speakQueue([text], opts);

export function listen({ onText, onEnd, onError }) {
  if (!Recognition) return null;
  const r = new Recognition();
  r.lang = 'fr-FR';
  r.continuous = true;
  r.interimResults = true;
  let finalText = '';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript.trim() + ' ';
      else interim += res[0].transcript;
    }
    onText?.(finalText, interim);
  };
  r.onerror = (e) => onError?.(e.error);
  r.onend = () => onEnd?.();
  r.start();
  return r;
}
