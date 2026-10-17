// Turns slide content into something a tutor can say aloud, and splits text into speakable chunks.

const clean = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[*_`#>]/g, '')
    .trim();

const endSentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** Split text into chunks of at most `maxLen` characters, preferring sentence boundaries. */
export function splitIntoChunks(text, maxLen = 180) {
  const sentences = clean(text).match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [];
  const chunks = [];
  let current = '';

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const raw of sentences) {
    let sentence = raw.trim();
    // A single run-on sentence: break at commas / spaces
    while (sentence.length > maxLen) {
      let cut = sentence.lastIndexOf(',', maxLen);
      if (cut < maxLen * 0.4) cut = sentence.lastIndexOf(' ', maxLen);
      if (cut <= 0) cut = maxLen;
      push();
      chunks.push(sentence.slice(0, cut + 1).trim());
      sentence = sentence.slice(cut + 1).trim();
    }
    if (current && (current + ' ' + sentence).length > maxLen) push();
    current = current ? `${current} ${sentence}` : sentence;
  }
  push();
  return chunks;
}

/**
 * Build a spoken explanation from slide content.
 * style "full": narrative, key points, analogy, example, memory hook.
 * style "simple": shorter, for students who are overloaded (narrative, one example, a restatement).
 */
export function buildSpokenScript(content, { style = 'full' } = {}) {
  if (!content) return '';
  const parts = [];

  if (content.title) parts.push(endSentence(clean(content.title)));
  if (content.narrative) parts.push(endSentence(clean(content.narrative)));

  const insights = (content.keyInsights || []).map(clean).filter(Boolean);
  const analogy = content.analogies?.[0];
  const scenario = content.realWorldScenario;

  if (style === 'simple') {
    if (scenario?.situation) {
      parts.push(`For example, ${endSentence(clean(scenario.situation).replace(/^[A-Z]/, (c) => c.toLowerCase()))}`);
      if (scenario.outcome) parts.push(endSentence(clean(scenario.outcome)));
    } else if (analogy?.comparison) {
      parts.push(endSentence(clean(analogy.comparison)));
    }
    if (insights[0]) parts.push(`In other words, ${endSentence(insights[0].replace(/^[A-Z]/, (c) => c.toLowerCase()))}`);
  } else {
    if (insights.length) {
      parts.push(`Here are the key points. ${insights.slice(0, 4).map((p, i) => `Point ${i + 1}: ${endSentence(p)}`).join(' ')}`);
    }
    if (analogy?.comparison) {
      parts.push(`Think of it like this. ${endSentence(clean(analogy.comparison))}${analogy.lesson ? ` ${endSentence(clean(analogy.lesson))}` : ''}`);
    }
    if (scenario?.situation) {
      parts.push(`For example, ${endSentence(clean(scenario.situation).replace(/^[A-Z]/, (c) => c.toLowerCase()))}${scenario.outcome ? ` ${endSentence(clean(scenario.outcome))}` : ''}`);
    }
    if (content.memoryHook) parts.push(`To remember this: ${endSentence(clean(content.memoryHook))}`);
  }

  return parts.filter(Boolean).join(' ');
}

/** Rough speaking time (used when the browser has no speech voices). 150 words/minute at rate 1. */
export function estimateSpeechMs(text, rate = 1) {
  const words = clean(text).split(' ').filter(Boolean).length;
  return Math.max(600, Math.round((words / 150) * 60000 / Math.max(rate, 0.25)));
}
