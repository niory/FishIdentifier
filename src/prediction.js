export const fishNames = {
  catfish: 'сом', gourami: 'гурами', perch: 'окунь',
  'northern pike': 'щука', unknown: 'неизвестный объект'
};
export const normalizeLabel = label => String(label || '').trim().toLowerCase();

// Conservative UI heuristics, not calibrated probabilities of correctness.
export function summarizePredictions(predictions) {
  if (!predictions.length || predictions.some(p => !Number.isFinite(p.probability))) {
    throw new Error('Некорректный ответ модели');
  }
  const scores = [...predictions].sort((a, b) => b.probability - a.probability);
  const top = scores[0];
  const label = normalizeLabel(top.className);
  return {
    ...top,
    translatedName: fishNames[label] || top.className,
    uncertain: label === 'unknown' || top.probability < 0.8 ||
      top.probability - (scores[1]?.probability || 0) < 0.15,
    scores
  };
}
