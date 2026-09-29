import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReviewResponsePrompt,
  REVIEW_RESPONSE_PROMPT_VERSION
} from '@/lib/ai/prompt';
import { REVIEW_RESPONSE_EVALUATION_FIXTURES } from '@/lib/ai/evaluation/review-response-fixtures';

test('AI quality fixtures remain valid prompt inputs', () => {
  assert.equal(
    REVIEW_RESPONSE_PROMPT_VERSION,
    'review-response-v1'
  );

  assert.equal(
    REVIEW_RESPONSE_EVALUATION_FIXTURES.length,
    5
  );

  for (const fixture of REVIEW_RESPONSE_EVALUATION_FIXTURES) {
    const prompt = buildReviewResponsePrompt(fixture);

    assert.equal(
      prompt.systemInstruction.includes(fixture.reviewContent),
      false,
      `${fixture.id}: review leaked into system instruction`
    );

    assert.equal(
      prompt.userContent.includes(fixture.reviewContent),
      true,
      `${fixture.id}: review missing from user content`
    );

    assert.match(prompt.userContent, /<review>/);
    assert.match(prompt.userContent, /<brand_voice>/);
    assert.match(
      prompt.userContent,
      new RegExp(`${fixture.rating}/5`)
    );
  }
});
