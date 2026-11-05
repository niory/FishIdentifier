import { summarizePredictions } from './prediction';
const score = (className, probability) => ({ className, probability });
test.each([['Catfish', 'сом'], ['Gourami', 'гурами'], ['Perch', 'окунь'], [' northern pike ', 'щука']])('translates %s', (label, translated) => {
  expect(summarizePredictions([score(label, 0.95), score('unknown', 0.05)])).toMatchObject({ translatedName: translated, uncertain: false });
});
test.each([
  [score('unknown', 0.99), score('Catfish', 0.01)],
  [score('Perch', 0.6), score('Catfish', 0.4)],
  [score('Perch', 0.82), score('Catfish', 0.75)]
])('declines unknown, weak or ambiguous answers', (...predictions) => {
  expect(summarizePredictions(predictions).uncertain).toBe(true);
});
test('rejects invalid predictions', () => {
  expect(() => summarizePredictions([])).toThrow();
  expect(() => summarizePredictions([score('Perch', NaN)])).toThrow();
});
