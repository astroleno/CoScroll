import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {loadModelPipeline} from '../../deploy/prepare-models.mjs';
const pipeline = await loadModelPipeline();
after(() => pipeline.dispose());

test('one restoration slot remains held across asynchronous yields; current work wins the next slot', async () => {
  const scheduler = new pipeline.ModelDecodeScheduler(), events = [];
  let release, active = 0, peak = 0;
  const first = scheduler.run('first', async () => {
    active++; peak = Math.max(peak, active); events.push('first');
    await new Promise(resolve => {release = resolve;}); active--;
  });
  await new Promise(resolve => setImmediate(resolve));
  const next = scheduler.run('next', async () => {active++; peak = Math.max(peak, active); events.push('next'); active--;}, 1);
  const current = scheduler.run('current', async () => {active++; peak = Math.max(peak, active); events.push('current'); active--;}, 0);
  release(); await Promise.all([first, next, current]);
  assert.equal(peak, 1); assert.deepEqual(events, ['first', 'current', 'next']);
});

test('queued obsolete work is canceled without construction; errors release the next slot and promotion is honored', async () => {
  const scheduler = new pipeline.ModelDecodeScheduler(), controller = new AbortController(), events = [];
  let release;
  const first = scheduler.run('first', () => new Promise(resolve => {release = resolve;}));
  await new Promise(resolve => setImmediate(resolve));
  const canceled = scheduler.run('obsolete', async () => {throw Error('canceled work must never execute');}, 0, controller.signal);
  const canceledAssertion = assert.rejects(canceled, {name: 'AbortError'}); controller.abort();
  const a = scheduler.run('a', async () => {events.push('a'); throw Error('decode failed');}, 1);
  const aAssertion = assert.rejects(a, /decode failed/);
  const b = scheduler.run('b', async () => {events.push('b');}, 1); scheduler.promote('b');
  release(); await Promise.all([first, canceledAssertion, aAssertion, b]);
  assert.deepEqual(events, ['b', 'a']);
});
