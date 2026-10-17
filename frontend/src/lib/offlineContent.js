// Content built directly from the lecture's own text, used when the AI service is unavailable.
//
// Nothing here invents subject matter: every statement shown to the student is a sentence from the uploaded
// lecture (or an AI-written insight already stored in the plan). That keeps the fallback honest and
// subject-neutral, unlike generic templates.

const STOPWORDS = new Set(
  ('about above after again also because been before being between both could does doing down during each from have having here into just like more most much only other over same should some such than that their them then there these they this those through under until very what when where which while will with would your'
  ).split(' ')
);

const OFFLINE_NOTE = 'The AI tutor is unavailable right now, so this is taken straight from your lecture.';

// Words of 4+ letters without stop-words; a trailing "s" is dropped so "cells" matches "cell".
const words = (text) =>
  (String(text ?? '').toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter((w) => !STOPWORDS.has(w)).map((w) => w.replace(/s$/, ''));

function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Self-contained statements about a topic: AI key insights first, then sentences of its own text. */
export function statementsFrom(topic) {
  const insights = (topic?.keyInsights || []).map((s) => String(s).trim()).filter((s) => s.length >= 10);
  const text = [topic?.description, topic?.full_content].filter(Boolean).join(' ');
  const sentences = (text.match(/[^.!?]+[.!?]/g) || [])
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 25 && s.length <= 220);

  const seen = new Set();
  return [...insights, ...sentences].filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Statements across the whole lecture that share the most words with the question. */
export function relevantStatements(question, topics, k = 3) {
  const wanted = new Set(words(question));
  if (!wanted.size) return [];

  const scored = [];
  topics.forEach((topic, topicIndex) => {
    for (const text of statementsFrom(topic)) {
      const score = new Set(words(text)).size ? [...new Set(words(text))].filter((w) => wanted.has(w)).length : 0;
      if (score > 0) scored.push({ text, topic: topic.title, topicIndex, score });
    }
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

// ----------------------------------------------------------------------------------------------- quizzes
/**
 * A short quiz from the lecture's own statements:
 *  - "Which statement is correct according to the lecture?" (distractors are true statements about other topics)
 *  - "Which topic does this statement belong to?" (options are topic titles)
 * Returns null when the topic has no usable text.
 */
export function buildLocalQuiz({ topic, topics = [], difficulty = 'medium', goal = 'gate', count = 5, sessionId = null, random = Math.random }) {
  const own = statementsFrom(topic);
  if (!own.length) return null;

  const others = topics.filter((t) => t !== topic && t.id !== topic.id);
  const distractorPool = others.flatMap((t) => statementsFrom(t));
  const questions = [];
  const base = { difficulty, conceptsTested: [topic.title], timeEstimate: 75, topic: { id: topic.id, title: topic.title } };

  for (const statement of own.slice(0, Math.min(3, count))) {
    const distractors = shuffle(distractorPool.filter((s) => s !== statement), random).slice(0, 3);
    const generic = [
      `The lecture says ${topic.title} does not apply to the situations it describes.`,
      `The lecture says the opposite of this is true for ${topic.title}.`,
      `${topic.title} is not mentioned in the lecture.`,
    ];
    while (distractors.length < 3) distractors.push(generic[distractors.length]);

    questions.push({
      ...base,
      id: `lq${questions.length + 1}`,
      type: 'conceptual',
      text: `Which statement about "${topic.title}" is correct, according to the lecture?`,
      options: [{ text: statement, isCorrect: true }, ...distractors.map((text) => ({ text, isCorrect: false }))],
      explanation: `The lecture states: "${statement}"`,
    });
  }

  if (topics.length >= 2) {
    const titles = others.map((t) => t.title).filter((t) => t && t !== topic.title);
    const sources = own.slice(0, Math.max(0, count - questions.length));
    for (const statement of sources) {
      const wrong = shuffle([...new Set(titles)], random).slice(0, 3);
      if (!wrong.length) break;
      questions.push({
        ...base,
        id: `lq${questions.length + 1}`,
        type: 'application',
        text: `Which topic of the lecture does this statement belong to? "${statement}"`,
        options: [{ text: topic.title, isCorrect: true }, ...wrong.map((text) => ({ text, isCorrect: false }))],
        explanation: `This is from the part of the lecture on "${topic.title}".`,
      });
    }
  }

  const limited = questions.slice(0, count);
  return {
    id: `local_quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${String(goal).toUpperCase()} Quiz: ${topic.title}`,
    topic: topic.title,
    studentGoal: goal,
    difficulty,
    questions: limited,
    totalQuestions: limited.length,
    estimatedTime: limited.reduce((sum, q) => sum + q.timeEstimate, 0),
    metadata: { generatedAt: new Date().toISOString(), source: 'local_lecture_text', topicId: topic.id, sessionId },
  };
}

// ------------------------------------------------------------------------------------------------ slides
const empty = { analogies: [], realWorldScenario: null, memoryHook: '' };

export function conceptSlide(topic, goal = 'gate') {
  const statements = statementsFrom(topic);
  return {
    ...empty,
    title: topic.title,
    narrative: `${topic.description || statements.slice(0, 2).join(' ') || `This part of the lecture covers ${topic.title}.`}\n\n${OFFLINE_NOTE}`,
    keyInsights: statements.slice(0, 4),
    interactiveElement: `Can you explain "${topic.title}" in your own words?`,
    examRelevance: topic.importance ? `Marked ${topic.importance} importance in this lecture (weightage ${topic.weightage ?? '-'}%) for ${String(goal).toUpperCase()}.` : '',
    commonTraps: (topic.commonMisconceptions || []).slice(0, 4),
  };
}

export function explainMoreSlide(topic) {
  const statements = statementsFrom(topic);
  return {
    ...empty,
    title: `More detail: ${topic.title}`,
    narrative: `${topic.full_content || topic.description || ''}\n\n${OFFLINE_NOTE}`.trim(),
    keyInsights: statements.slice(0, 6),
    interactiveElement: 'Which of these points is least clear to you? Ask about it.',
    examRelevance: '',
    commonTraps: (topic.commonMisconceptions || []).slice(0, 4),
  };
}

export function questionSlide(topic, question, topics = []) {
  const found = relevantStatements(question, topics.length ? topics : [topic], 4);
  return {
    ...empty,
    title: `Your question: ${String(question).slice(0, 70)}${String(question).length > 70 ? '...' : ''}`,
    narrative: found.length
      ? `You asked: "${question}"\n\nThese passages of your lecture are the most relevant to it. ${OFFLINE_NOTE}`
      : `You asked: "${question}"\n\nI could not find this in your lecture, and the AI tutor is unavailable. Try rewording the question with terms from the lecture.`,
    keyInsights: found.map((f) => `${f.text} (${f.topic})`),
    interactiveElement: 'Does this answer your question? If not, try asking again with other keywords.',
    examRelevance: '',
    commonTraps: [],
  };
}

export function quizResultsSlide(topic, context = '') {
  return {
    ...empty,
    title: `Quiz review: ${topic.title}`,
    narrative: `${context || 'Here is how your quiz went.'}\n\nReview the points below and retake the quiz when you are ready. ${OFFLINE_NOTE}`,
    keyInsights: statementsFrom(topic).slice(0, 5),
    interactiveElement: 'Which question surprised you the most?',
    examRelevance: '',
    commonTraps: (topic.commonMisconceptions || []).slice(0, 3),
  };
}

export function simplifiedSlide(topic, context = '') {
  const statements = statementsFrom(topic);
  const heard = context ? ` The teacher just said: "${String(context).slice(-240)}".` : '';
  return {
    ...empty,
    title: `In simple terms: ${topic.title}`,
    narrative: `${statements.slice(0, 2).join(' ') || `Let us go back to the basics of ${topic.title}.`}${heard}`,
    keyInsights: [...statements].sort((a, b) => a.length - b.length).slice(0, 3),
    interactiveElement: 'Can you say the main idea in one sentence?',
    examRelevance: '',
    commonTraps: (topic.commonMisconceptions || []).slice(0, 2),
  };
}

export function completionSlide({ topics = [], completed = 0, averageScore = 0, goal = 'gate' } = {}) {
  return {
    ...empty,
    title: 'Lecture Complete',
    narrative: `You worked through all ${topics.length} topics of this lecture${completed ? ` and mastered ${completed} of them` : ''}${averageScore ? ` with an average quiz score of ${averageScore}%` : ''}. Use the topic list to revisit anything that still feels shaky.`,
    keyInsights: topics.slice(0, 8).map((t) => `${t.title}: ${(statementsFrom(t)[0] || t.description || 'review this topic').slice(0, 140)}`),
    interactiveElement: 'Which topic would you like to revisit first?',
    examRelevance: `Spend your remaining ${String(goal).toUpperCase()} preparation time on the topics where your quiz scores were lowest.`,
    commonTraps: ['Re-reading instead of testing yourself', 'Skipping topics that felt easy once'],
    memoryHook: 'Learn, quiz, review, repeat.',
  };
}
