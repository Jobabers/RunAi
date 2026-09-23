const config = require('../config');
const { compareDateKey } = require('../utils/dates');

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const TRAINING_TYPES = new Set(['Easy Run', 'Tempo Run', 'Long Run', 'Recovery Run']);

const planResponseSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    recommendation: { type: 'string' },
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          session_date: { type: 'string' },
          training_type: { type: 'string' },
          target_distance: { type: 'number' },
          target_duration_minutes: { type: 'integer' },
          note: { type: 'string' },
        },
        required: ['session_date', 'training_type', 'target_distance', 'target_duration_minutes', 'note'],
      },
    },
  },
  required: ['summary', 'recommendation', 'sessions'],
};

function isGeminiEnabled() {
  return config.ai.provider === 'gemini' && Boolean(config.ai.geminiApiKey);
}

function extractGeminiText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  if (typeof data?.outputText === 'string') return data.outputText;
  if (typeof data?.text === 'string') return data.text;

  const candidates = data?.candidates || data?.response?.candidates || [];
  const text = candidates
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n');

  if (text) return text;

  throw new Error('Gemini did not return text output');
}

function parseJsonOutput(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Gemini returned an empty response');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini returned non-JSON output');
    return JSON.parse(match[0]);
  }
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizeTrainingType(value) {
  const normalized = String(value || '').trim();
  return TRAINING_TYPES.has(normalized) ? normalized : 'Easy Run';
}

function sanitizeSessions(rawSessions, { startDate, endDate, goal }) {
  if (!startDate) return [];

  const maxDistance = Math.max(1, Number(goal?.target_distance || 1));
  const seenDates = new Set();

  return (Array.isArray(rawSessions) ? rawSessions : [])
    .map((session) => {
      const sessionDate = String(session.session_date || '').slice(0, 10);
      const targetDistance = toFiniteNumber(session.target_distance);
      const targetDuration = Math.round(toFiniteNumber(session.target_duration_minutes) || 0);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return null;
      if (compareDateKey(sessionDate, startDate) < 0) return null;
      if (endDate && compareDateKey(sessionDate, endDate) > 0) return null;
      if (seenDates.has(sessionDate)) return null;
      if (!targetDistance || targetDistance <= 0 || !targetDuration || targetDuration <= 0) return null;

      seenDates.add(sessionDate);
      return {
        session_date: sessionDate,
        training_type: sanitizeTrainingType(session.training_type),
        target_distance: Number(Math.min(targetDistance, maxDistance).toFixed(1)),
        target_duration_minutes: Math.max(1, targetDuration),
        status: compareDateKey(sessionDate, startDate) === 0 ? 'available' : 'locked',
        note: String(session.note || 'ทำเควสตามแผน โดยใช้ระยะทางเป็นเกณฑ์หลัก').slice(0, 240),
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareDateKey(left.session_date, right.session_date));
}

function buildRunnerContext({ user, goal, runs }) {
  return {
    user: {
      age: user.age,
      weight: user.weight,
      height: user.height,
      experience_level: user.experience_level,
    },
    goal: {
      goal_type: goal.goal_type,
      target_distance: Number(goal.target_distance),
      target_duration_minutes: goal.target_duration_minutes ? Number(goal.target_duration_minutes) : null,
      target_date: goal.target_date,
    },
    recent_runs: runs.slice(0, 10).map((run) => ({
      run_date: run.run_date,
      distance: Number(run.distance),
      duration_minutes: Number(run.duration_minutes),
      run_type: run.run_type,
      source: run.source || 'manual',
    })),
  };
}

async function callGeminiJson({ systemInstruction, input, schema }) {
  const response = await fetch(GEMINI_INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.ai.geminiApiKey,
    },
    body: JSON.stringify({
      model: config.ai.model,
      store: false,
      system_instruction: systemInstruction,
      input,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema,
      },
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.error?.message || data?.message || 'Gemini API request failed';
    throw new Error(message);
  }

  if (data && typeof data === 'object' && data.summary && Array.isArray(data.sessions)) {
    return data;
  }

  return parseJsonOutput(extractGeminiText(data));
}

function fallbackResult({ sessions, trigger, reason = null }) {
  return {
    enabled: false,
    source: 'rule_based',
    summary: 'ใช้ rule-based planner เพราะยังไม่ได้เปิด Gemini หรือ Gemini ตอบกลับไม่สำเร็จ',
    recommendation: trigger === 'initial_plan'
      ? 'สร้างแผนแบบค่อยเป็นค่อยไป โดยมี Rest Day แทรก'
      : 'ปรับเควสอนาคตโดยลดความหนักลงชั่วคราว',
    reason,
    sessions,
  };
}

async function createInitialPlan({ user, goal, runs, startDate, endDate, fallbackSessions }) {
  if (!isGeminiEnabled()) {
    return fallbackResult({ sessions: fallbackSessions, trigger: 'initial_plan' });
  }

  try {
    const aiResult = await callGeminiJson({
      systemInstruction: [
        'You are RunAI, an AI running coach.',
        'Create safe RPG-style daily running quests for improving running performance.',
        'Return only JSON matching the schema.',
        'Use distance as the main quest pass criterion.',
        'Include rest days by omitting sessions on rest dates.',
        'Do not create more than one quest per date.',
      ].join(' '),
      input: {
        trigger: 'initial_plan',
        start_date: startDate,
        end_date: endDate,
        context: buildRunnerContext({ user, goal, runs }),
      },
      schema: planResponseSchema,
    });
    const sessions = sanitizeSessions(aiResult.sessions, { startDate, endDate, goal });

    if (!sessions.length) {
      return fallbackResult({ sessions: fallbackSessions, trigger: 'initial_plan', reason: 'Gemini returned no valid sessions' });
    }

    return {
      enabled: true,
      source: 'gemini',
      summary: String(aiResult.summary || 'Gemini สร้าง Training Plan ให้แล้ว'),
      recommendation: String(aiResult.recommendation || 'ฝึกตาม Daily Quest และคุมความหนักตามแผน'),
      sessions,
    };
  } catch (error) {
    return fallbackResult({ sessions: fallbackSessions, trigger: 'initial_plan', reason: error.message });
  }
}

async function adjustPlan({ user, goal, runs, failedSession, futureSessions, reason, fallbackSessions, triggerType }) {
  if (!futureSessions.length) {
    return fallbackResult({ sessions: fallbackSessions, trigger: triggerType, reason: 'No future sessions to adjust' });
  }

  if (!isGeminiEnabled()) {
    return fallbackResult({ sessions: fallbackSessions, trigger: triggerType, reason });
  }

  try {
    const startDate = futureSessions[0]?.session_date;
    const endDate = futureSessions[futureSessions.length - 1]?.session_date;
    const aiResult = await callGeminiJson({
      systemInstruction: [
        'You are RunAI, an AI running coach.',
        'Adjust only future running quests after a failed or expired quest.',
        'Return only JSON matching the schema.',
        'Keep the current failed or expired quest unchanged.',
        'Use distance as the main quest pass criterion.',
        'Do not create more than one quest per date.',
      ].join(' '),
      input: {
        trigger: triggerType,
        reason,
        failed_or_expired_session: failedSession,
        future_sessions: futureSessions,
        context: buildRunnerContext({ user, goal, runs }),
      },
      schema: planResponseSchema,
    });
    const sessions = sanitizeSessions(aiResult.sessions, { startDate, endDate, goal });

    if (!sessions.length) {
      return fallbackResult({ sessions: fallbackSessions, trigger: triggerType, reason: 'Gemini returned no valid adjusted sessions' });
    }

    return {
      enabled: true,
      source: 'gemini',
      summary: String(aiResult.summary || 'Gemini วิเคราะห์และปรับแผนอนาคตให้แล้ว'),
      recommendation: String(aiResult.recommendation || 'ยอมรับแผนเมื่อพร้อม แล้วทำเควสถัดไปตามแผนใหม่'),
      reason,
      sessions,
    };
  } catch (error) {
    return fallbackResult({ sessions: fallbackSessions, trigger: triggerType, reason: error.message });
  }
}

module.exports = {
  adjustPlan,
  createInitialPlan,
  isGeminiEnabled,
  sanitizeSessions,
};
