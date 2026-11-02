import assert from 'node:assert/strict';
import test from 'node:test';
import { tmdbImageUrl } from '../src/lib/tmdb-image';

test('TMDB source sizes are preserved and browser delivery goes directly to Cloudinary', () => {
  for (const size of ['w185', 'w500', 'w780', 'w1280', 'original']) {
    const source = `https://image.tmdb.org/t/p/${size}/poster_123.jpg`;
    const result = tmdbImageUrl(source);
    assert.equal(result, `https://res.cloudinary.com/lz6hvjwd/image/fetch/f_auto,q_auto/${source}`);
    assert.equal(tmdbImageUrl(result), result);
  }
});

test('only exact TMDB image addresses are eligible; uploads and empty sources remain intact', () => {
  for (const source of [null, undefined, '', '/poster.jpg',
    'https://res.cloudinary.com/lz6hvjwd/image/upload/poster.jpg',
    'https://image.tmdb.org.attacker.test/t/p/w500/poster.jpg',
    'https://image.tmdb.org@attacker.test/t/p/w500/poster.jpg',
    'https://image.tmdb.org/t/p/w500/poster.jpg?redirect=1',
    'https://image.tmdb.org/t/p/w500/../poster.jpg']) {
    assert.equal(tmdbImageUrl(source), source);
  }
});
