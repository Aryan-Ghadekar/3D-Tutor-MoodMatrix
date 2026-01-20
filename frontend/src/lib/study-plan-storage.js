const studyPlans = new Map();

export function storeStudyPlan(sessionId, studyPlan) {
  const enrichedPlan = {
    ...studyPlan,
    storedAt: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  
  studyPlans.set(sessionId, enrichedPlan);
  console.log(`Stored study plan: ${sessionId}`);
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('lastSessionId', sessionId);
      localStorage.setItem(`studyPlan_${sessionId}`, JSON.stringify(enrichedPlan));
    } catch (e) {
      console.warn('LocalStorage unavailable:', e.message);
    }
  }
  
  return sessionId;
}

export function getStudyPlan(sessionId) {
  let plan = studyPlans.get(sessionId);
  
  if (!plan && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`studyPlan_${sessionId}`);
      if (stored) {
        plan = JSON.parse(stored);
        studyPlans.set(sessionId, plan);
      }
    } catch (e) {
      console.warn('LocalStorage read failed:', e.message);
    }
  }
  
  if (plan) {
    plan.accessedAt = new Date().toISOString();
    studyPlans.set(sessionId, plan);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`studyPlan_${sessionId}`, JSON.stringify(plan));
      } catch (e) {
        console.warn('LocalStorage update failed:', e.message);
      }
    }
  }
  
  return plan;
}

export function hasStudyPlan(sessionId) {
  if (studyPlans.has(sessionId)) {
    return true;
  }
  
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(`studyPlan_${sessionId}`) !== null;
    } catch (e) {
      console.warn('LocalStorage check failed:', e.message);
      return false;
    }
  }
  
  return false;
}

export function clearStudyPlan(sessionId) {
  let existed = false;
  
  existed = studyPlans.delete(sessionId);
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`studyPlan_${sessionId}`);
      if (localStorage.getItem('lastSessionId') === sessionId) {
        localStorage.removeItem('lastSessionId');
      }
    } catch (e) {
      console.warn('LocalStorage cleanup failed:', e.message);
    }
  }
  
  if (existed) {
    console.log(`Cleared study plan: ${sessionId}`);
  }
  
  return existed;
}

export function getAllSessions() {
  const sessions = Array.from(studyPlans.keys());
  
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('studyPlan_')) {
          const sessionId = key.replace('studyPlan_', '');
          if (!sessions.includes(sessionId)) {
            sessions.push(sessionId);
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage session scan failed:', e.message);
    }
  }
  
  return sessions;
}

export function getLastSessionId() {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('lastSessionId');
    } catch (e) {
      console.warn('LocalStorage get last session failed:', e.message);
    }
  }
  return null;
}

export function cleanupOldPlans() {
  const now = new Date();
  let removed = 0;
  
  const sessionsToRemove = [];
  
  for (const [sessionId, plan] of studyPlans.entries()) {
    const storedAt = new Date(plan.storedAt);
    const hoursDiff = (now - storedAt) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      sessionsToRemove.push(sessionId);
      removed++;
    }
  }
  
  sessionsToRemove.forEach(sessionId => {
    studyPlans.delete(sessionId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`studyPlan_${sessionId}`);
      } catch (e) {
        console.warn('LocalStorage removal failed:', e.message);
      }
    }
  });
  
  if (typeof window !== 'undefined') {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('studyPlan_')) {
          try {
            const plan = JSON.parse(localStorage.getItem(key));
            if (plan && plan.storedAt) {
              const storedAt = new Date(plan.storedAt);
              const hoursDiff = (now - storedAt) / (1000 * 60 * 60);
              if (hoursDiff > 24) {
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            keysToRemove.push(key);
          }
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        removed++;
      });
    } catch (e) {
      console.warn('LocalStorage cleanup failed:', e.message);
    }
  }
  
  if (removed > 0) {
    console.log(`Cleaned up ${removed} old study plans`);
  }
  
  return removed;
}

if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldPlans, 60 * 60 * 1000);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cleanupOldPlans();
  });
}

export default {
  storeStudyPlan,
  getStudyPlan,
  hasStudyPlan,
  clearStudyPlan,
  getAllSessions,
  getLastSessionId,
  cleanupOldPlans
};