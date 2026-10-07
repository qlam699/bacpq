import test from 'node:test';
import assert from 'node:assert/strict';

import { formatMarketTitle } from './format';

test('formatMarketTitle renders current sell and buy values in title format', () => {
  assert.equal(formatMarketTitle(123456, 125000), '125.000₫ - 123.456₫');
});
