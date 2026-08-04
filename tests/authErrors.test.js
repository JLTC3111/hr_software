import test from 'node:test';
import assert from 'node:assert/strict';
import { isRejectedByServer } from '../src/utils/authErrors.js';

/*
 * This predicate decides whether a user's persisted session is destroyed.
 * Getting it wrong in one direction costs a wasted reload; in the other it
 * signs someone out because their train went into a tunnel. Both directions
 * are covered here.
 */

test('a server that refuses the credentials counts as a rejection', () => {
  // GoTrue returns AuthApiError with a 4xx for a revoked or invalid token.
  assert.equal(isRejectedByServer({ name: 'AuthApiError', status: 401, message: 'Invalid JWT' }), true);
  assert.equal(isRejectedByServer({ name: 'AuthApiError', status: 403, message: 'Forbidden' }), true);
  assert.equal(isRejectedByServer({ status: 404, message: 'User from sub claim in JWT does not exist' }), true);

  // Some paths surface only a message.
  assert.equal(isRejectedByServer({ message: 'invalid claim: missing sub claim' }), true);
  assert.equal(isRejectedByServer({ message: 'JWT expired' }), true);
  assert.equal(isRejectedByServer({ message: 'Auth session missing!' }), true);
});

test('a request that never reached the server is never a rejection', () => {
  // GoTrue's own marker for "could not reach the auth server".
  assert.equal(isRejectedByServer({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }), false);
  // Our fetch wrapper aborts on DEFAULT_REQUEST_TIMEOUT.
  assert.equal(isRejectedByServer({ name: 'AbortError', message: 'The operation was aborted' }), false);
  // A bare network failure from fetch().
  assert.equal(isRejectedByServer({ name: 'TypeError', message: 'Failed to fetch' }), false);
  assert.equal(isRejectedByServer({ message: 'network request failed' }), false);
  assert.equal(isRejectedByServer({ message: 'Request timed out' }), false);
});

test('the server failing is not the credentials being refused', () => {
  assert.equal(isRejectedByServer({ status: 500, message: 'Internal Server Error' }), false);
  assert.equal(isRejectedByServer({ status: 502, message: 'Bad Gateway' }), false);
  assert.equal(isRejectedByServer({ status: 503, message: 'Service Unavailable' }), false);
});

test('nothing, or anything unrecognised, leaves the token alone', () => {
  assert.equal(isRejectedByServer(null), false);
  assert.equal(isRejectedByServer(undefined), false);
  assert.equal(isRejectedByServer({}), false);
  assert.equal(isRejectedByServer({ message: 'something we have never seen' }), false);
});

test('a 4xx wins over a message that mentions the network', () => {
  // The status is the stronger signal: the server answered.
  assert.equal(isRejectedByServer({ status: 401, message: 'network' }), true);
});
