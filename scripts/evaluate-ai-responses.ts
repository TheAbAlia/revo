import { generateReviewResponse } from '@/lib/ai/review-response';
import { REVIEW_RESPONSE_EVALUATION_FIXTURES } from '@/lib/ai/evaluation/review-response-fixtures';

async function main() {
  console.log('AI review response quality evaluation');
  console.log('=====================================');

  let failures = 0;

  for (const fixture of REVIEW_RESPONSE_EVALUATION_FIXTURES) {
    console.log(`\n[${fixture.id}]`);
    console.log(`Rating: ${fixture.rating}/5`);
    console.log(`Review: ${fixture.reviewContent}`);

    try {
      const result = await generateReviewResponse(fixture);

      console.log(`Response: ${result.content}`);
      console.log(`Model: ${result.provider}/${result.model}`);
      console.log(`Prompt: ${result.promptVersion}`);
    } catch (error) {
      failures += 1;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.log(`Evaluation failed: ${message}`);
    }
  }

  console.log(
    `\nCompleted with ${failures} failed fixture(s).`
  );

  if (failures > 0) {
    console.log(
      'Live model evaluation is incomplete; no quality conclusion should be drawn.'
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
