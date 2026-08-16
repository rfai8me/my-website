import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluatePublicationState,
  localDateAt,
  PublicationState
} from '../lib/publication-state.js';

const TODAY = '2026-06-15';

const matrix = [
  ['2026-06-01', undefined, PublicationState.PUBLISHED],
  ['2026-06-14', undefined, PublicationState.PUBLISHED],
  ['2026-06-15', undefined, PublicationState.PUBLISHED],
  ['2026-06-16', undefined, PublicationState.NOT_EMITTED],
  ['2026-12-25', undefined, PublicationState.NOT_EMITTED],
  ['2026-06-01', '2026-06-14', PublicationState.TOMBSTONED],
  ['2026-06-01', '2026-06-15', PublicationState.TOMBSTONED],
  ['2026-06-01', '2026-06-16', PublicationState.PUBLISHED],
  ['2026-06-20', '2026-06-25', PublicationState.NOT_EMITTED],
  ['2026-06-20', '2026-06-14', PublicationState.NOT_EMITTED],
  ['2026-06-20', '2026-06-19', PublicationState.NOT_EMITTED]
];

for (const [publishAfterDate, deleteDate, expected] of matrix) {
  test(`${publishAfterDate} / ${deleteDate ?? 'none'} => ${expected}`, () => {
    assert.equal(evaluatePublicationState({ publishAfterDate, deleteDate }, TODAY), expected);
  });
}

test('repository timezone determines the calendar date', () => {
  const instant = new Date('2026-06-14T20:00:00Z');
  assert.equal(localDateAt(instant, 'Asia/Kolkata'), '2026-06-15');
  assert.equal(localDateAt(instant, 'America/Los_Angeles'), '2026-06-14');
});

test('invalid calendar dates are rejected', () => {
  assert.throws(
    () => evaluatePublicationState({ publishAfterDate: '2026-02-30' }, TODAY),
    /valid calendar date/
  );
});

test('time must be injected', () => {
  assert.throws(
    () => evaluatePublicationState({ publishAfterDate: TODAY }),
    /today must use YYYY-MM-DD/
  );
});
