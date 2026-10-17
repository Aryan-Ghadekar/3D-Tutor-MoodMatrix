// Builds the downloadable study notes (Markdown / printable HTML) from a finished study session,
// and the teacher's class report from the live dashboard data.

const list = (items) => (items || []).map((i) => String(i).trim()).filter(Boolean);
const bullets = (items) => list(items).map((i) => `- ${i}`).join('\n');
const pct = (n) => `${Math.round(n)}%`;

function slideSection(slide) {
  const c = slide.content || {};
  const out = [];
  if (c.narrative) out.push(c.narrative.trim());
  if (list(c.keyInsights).length) out.push(`**Key points**\n${bullets(c.keyInsights)}`);
  const analogies = (c.analogies || []).filter((a) => a?.comparison);
  if (analogies.length) out.push(`**Analogy**\n${analogies.map((a) => `- ${a.comparison}${a.lesson ? ` ${a.lesson}` : ''}`).join('\n')}`);
  if (c.realWorldScenario?.situation) {
    const s = c.realWorldScenario;
    out.push(`**Real-world example**\n${[s.situation, s.application, s.outcome].filter(Boolean).join(' ')}`);
  }
  if (c.examRelevance) out.push(`**Exam relevance**\n${c.examRelevance}`);
  if (list(c.commonTraps).length) out.push(`**Common traps**\n${bullets(c.commonTraps)}`);
  if (c.memoryHook) out.push(`**Memory hook:** ${c.memoryHook}`);
  return out.join('\n\n');
}

const SLIDE_HEADINGS = {
  'explain-more': 'Deeper explanation',
  'simplified-explanation': 'Simplified explanation',
  'quiz-results': 'Quiz review',
  'ask-question': 'Your question',
};

/**
 * @param {object} data
 * @param {string} data.lectureTitle
 * @param {Array}  data.topics        topic objects (title, ...) in lecture order
 * @param {Array}  data.slides        every slide generated in the session
 * @param {Array}  data.quizReviews   [{topicIndex, topicTitle, score, items:[{question, yourAnswer, correctAnswer, explanation, correct}]}]
 * @param {Array}  data.quizHistory   [{topicId, score, totalQuestions}]
 * @param {Array}  data.misconceptions [{concept, description}]
 */
export function buildNotes(data) {
  const { lectureTitle = 'Lecture', instructor, goal, knowledgeLevel, topics = [], slides = [], quizReviews = [], quizHistory = [], misconceptions = [] } = data;
  const date = (data.date ? new Date(data.date) : new Date()).toISOString().slice(0, 10);

  const lines = [`# ${lectureTitle} - Study Notes`, ''];
  lines.push(`*${[date, goal && `Goal: ${String(goal).toUpperCase()}`, knowledgeLevel && `Level: ${knowledgeLevel}`, instructor && `Instructor: ${instructor}`].filter(Boolean).join(' | ')}*`, '');

  const covered = new Set(slides.map((s) => s.metadata?.topicIndex).filter((i) => typeof i === 'number'));
  const scores = quizReviews.map((q) => q.score);
  lines.push('## Session summary', '');
  lines.push(`- Topics studied: ${covered.size} of ${topics.length}`);
  lines.push(`- Quizzes taken: ${quizReviews.length || quizHistory.length}${scores.length ? ` (average ${pct(scores.reduce((a, b) => a + b, 0) / scores.length)})` : ''}`);
  const questions = slides.filter((s) => s.type === 'ask-question').length;
  if (questions) lines.push(`- Questions asked: ${questions}`);
  lines.push('');

  topics.forEach((topic, index) => {
    const topicSlides = slides.filter((s) => s.metadata?.topicIndex === index && s.type !== 'quiz-results');
    const reviews = quizReviews.filter((q) => q.topicIndex === index);
    if (!topicSlides.length && !reviews.length) return;

    lines.push(`## ${index + 1}. ${topic.title}`, '');
    for (const slide of topicSlides) {
      const heading = SLIDE_HEADINGS[slide.type];
      if (heading) {
        lines.push(`### ${heading}`, '');
        if (slide.type === 'ask-question' && slide.metadata?.context) lines.push(`> ${slide.metadata.context}`, '');
      }
      lines.push(slideSection(slide), '');
    }

    for (const review of reviews) {
      lines.push(`### Quiz: ${pct(review.score)}`, '');
      for (const item of review.items || []) {
        lines.push(`- ${item.correct ? '[correct]' : '[missed]'} ${item.question}`);
        if (!item.correct) lines.push(`  - Your answer: ${item.yourAnswer || '-'}`, `  - Correct answer: ${item.correctAnswer}`);
        if (item.explanation) lines.push(`  - Why: ${item.explanation}`);
      }
      lines.push('');
    }
  });

  const gaps = misconceptions.map((m) => `${m.concept || 'General'}${m.description ? `: ${m.description}` : ''}`);
  const missedTopics = quizReviews.filter((q) => q.score < 70).map((q) => q.topicTitle);
  if (gaps.length || missedTopics.length) {
    lines.push('## Areas to revisit', '');
    if (missedTopics.length) lines.push(bullets([...new Set(missedTopics)].map((t) => `Review **${t}** (quiz score below 70%)`)));
    if (gaps.length) lines.push(bullets([...new Set(gaps)]));
    lines.push('');
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// ---------------------------------------------------------------------------------------------------
// Teacher class report
// ---------------------------------------------------------------------------------------------------
const EVENT_LABELS = {
  class_started: 'Class started',
  student_joined: 'A student joined',
  topic_changed: (e, d) => `Moved to topic ${e.topicIndex + 1}: ${d.topics?.[e.topicIndex] ?? ''}`,
  paused: (e) => `Paused for ${e.mode === 'quiz' ? 'a quick quiz' : 'an avatar explanation'}`,
  resumed: 'Resumed',
  class_ended: 'Class ended',
};

const clock = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function buildClassReport(d) {
  const lines = [`# Class report - ${d.lectureTopic || 'Lecture'}`, ''];
  const started = d.startedAt;
  const last = d.events?.length ? d.events[d.events.length - 1].t : started;
  lines.push(`*Code ${d.state?.code} | ${new Date(started * 1000).toISOString().slice(0, 10)} | ${Math.max(1, Math.round((last - started) / 60))} min*`, '');

  const history = d.history || [];
  const loads = history.map((h) => h.averageLoad);
  const peak = history.reduce((best, h) => (h.averageLoad > (best?.averageLoad ?? -1) ? h : best), null);
  lines.push('## Attendance and cognitive load', '');
  lines.push(`- Students joined: ${d.aggregate?.joined ?? 0}`);
  if (loads.length) {
    lines.push(`- Average class load: ${Math.round(loads.reduce((a, b) => a + b, 0) / loads.length)}/100`);
    lines.push(`- Peak average load: ${Math.round(peak.averageLoad)}/100 at ${clock(peak.t)} (${peak.high} of ${peak.active} students in high load)`);
    const overloaded = history.filter((h) => h.active > 0 && h.high / h.active >= 0.4).length;
    lines.push(`- Time with the class overloaded: about ${Math.round((overloaded * 5) / 60)} min`);
  } else {
    lines.push('- No cognitive-load data was reported.');
  }
  lines.push('');

  const quiz = Object.entries(d.quizResults || {});
  if (quiz.length) {
    lines.push('## Pause quizzes', '');
    for (const [id, r] of quiz) lines.push(`- Pause ${id}: ${r.responses} responses, average ${pct(r.averageScore)}`);
    lines.push('');
  }

  if (d.events?.length) {
    lines.push('## Timeline', '');
    for (const e of d.events.filter((e) => e.kind !== 'student_joined')) {
      const label = EVENT_LABELS[e.kind];
      const text = typeof label === 'function' ? label(e, d) : label || e.kind;
      lines.push(`- ${clock(e.t)} ${text}`);
    }
    lines.push('');
  }

  if (d.recentTranscript) lines.push('## Last captured lecture audio', '', `> ${d.recentTranscript}`, '');
  return `${lines.join('\n').trim()}\n`;
}

// ---------------------------------------------------------------------------------------------------
// Rendering / download helpers
// ---------------------------------------------------------------------------------------------------
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');

/** Minimal Markdown (headings, lists, quotes, bold/italic, paragraphs) to a printable HTML document. */
export function markdownToHtml(markdown, title = 'Notes') {
  const html = [];
  let depth = 0;       // 0 = not in a list, 1 = list, 2 = nested list
  let liOpen = false;
  const closeLists = () => {
    if (depth === 2) html.push('</ul>');
    if (liOpen) html.push('</li>');
    if (depth >= 1) html.push('</ul>');
    depth = 0;
    liOpen = false;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    const bullet = line.match(/^(\s*)- (.*)$/);
    if (bullet) {
      const nested = bullet[1].length >= 2 && depth >= 1;
      if (!nested) {
        if (depth === 2) { html.push('</ul>'); depth = 1; }
        if (depth === 0) { html.push('<ul>'); depth = 1; }
        if (liOpen) html.push('</li>');
        html.push(`<li>${inline(bullet[2])}`);
        liOpen = true;
      } else {
        if (depth === 1) { html.push('<ul>'); depth = 2; }
        html.push(`<li>${inline(bullet[2])}</li>`);
      }
      continue;
    }
    closeLists();
    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (heading) html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    else if (line.startsWith('> ')) html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    else if (line.trim()) html.push(`<p>${inline(line)}</p>`);
  }
  closeLists();

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{font-family:Georgia,serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.55;color:#1a1a1a}
h1{border-bottom:2px solid #333;padding-bottom:.3rem}h2{margin-top:2rem;border-bottom:1px solid #bbb}h3{margin-top:1.2rem;color:#334}
blockquote{border-left:4px solid #8aa;margin:.6rem 0;padding:.1rem .8rem;color:#445;background:#f3f6f8}
ul{margin:.3rem 0}@media print{body{margin:0}h2{page-break-after:avoid}}
</style></head><body>${html.join('\n')}</body></html>`;
}

export function downloadFile(filename, text, mime = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printHtml(html) {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
  return true;
}

export const safeFilename = (s) => String(s || 'notes').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'notes';
