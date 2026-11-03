// Répétition espacée (variante simplifiée de SM-2). Dates locales au format AAAA-MM-JJ.
export const today = () => new Date().toLocaleDateString('sv-SE');

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dt.toLocaleDateString('sv-SE');
}

export const newCard = () => ({ ease: 2.5, interval: 0, due: today(), reps: 0, lapses: 0 });

// g : 1 = encore, 2 = bien, 3 = facile
export function gradeCard(card, g) {
  const c = { ...card };
  if (g === 1) {
    c.lapses += 1;
    c.reps = 0;
    c.interval = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = today();
    return c;
  }
  if (c.reps === 0) c.interval = g === 3 ? 4 : 1;
  else if (c.reps === 1) c.interval = g === 3 ? 8 : 3;
  else c.interval = Math.max(c.interval + 1, Math.round(c.interval * c.ease * (g === 3 ? 1.3 : 1)));
  c.reps += 1;
  if (g === 3) c.ease = Math.min(3, c.ease + 0.1);
  c.due = addDays(today(), c.interval);
  return c;
}

export const isDue = (note, t = today()) => (note.srs?.due || t) <= t;
export const isMastered = (note) => (note.srs?.interval || 0) >= 21;
export const isNew = (note) => !note.srs || (note.srs.reps === 0 && note.srs.lapses === 0 && note.srs.interval === 0);

export function dueNotes(notebook, t = today()) {
  return notebook
    .filter((n) => isDue(n, t))
    .sort((a, b) => Number(isNew(a)) - Number(isNew(b)) || (a.srs.due < b.srs.due ? -1 : a.srs.due > b.srs.due ? 1 : 0));
}

export function nextDue(notebook, t = today()) {
  const future = notebook.map((n) => n.srs?.due).filter((d) => d && d > t).sort();
  return future[0] || null;
}

export function dueLabel(dateStr, t = today()) {
  if (!dateStr || dateStr <= t) return "aujourd'hui";
  if (dateStr === addDays(t, 1)) return 'demain';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
