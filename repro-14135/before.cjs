/**
 * BEFORE fix: Simulates what the unfixed PosthogExporter sends to PostHog.
 *
 * The span output has no toolCalls, so formatMessages() falls through to
 * JSON.stringify — producing a text blob that PostHog cannot parse for
 * tool extraction. The Tools tab stays empty.
 */
const { PostHog } = require('posthog-node');

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
if (!POSTHOG_API_KEY) {
  console.error('Set POSTHOG_API_KEY env var');
  process.exit(1);
}

const client = new PostHog(POSTHOG_API_KEY, {
  host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
  flushAt: 1,
  flushInterval: 500,
});

const event = {
  distinctId: 'repro-14135-before',
  event: '$ai_generation',
  properties: {
    $ai_trace_id: 'trace-14135-before-' + Date.now(),
    $ai_span_id: 'span-14135-before-' + Date.now(),
    $ai_model: 'llama-3.3-70b-versatile',
    $ai_provider: 'groq',
    $ai_input_tokens: 150,
    $ai_output_tokens: 45,
    $ai_stream: false,
    $ai_latency: 1.2,
    $ai_input: [
      { role: 'system', content: [{ type: 'text', text: 'You are a weather assistant.' }] },
      { role: 'user', content: [{ type: 'text', text: 'What is the weather in Paris?' }] },
    ],
    // BROKEN: toolCalls missing from span output, formatMessages() stringifies it
    $ai_output_choices: [
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify({ text: '', warnings: undefined }),
          },
        ],
      },
    ],
  },
};

console.log('Sending BEFORE (broken) event...');
console.log('$ai_output_choices:', JSON.stringify(event.properties.$ai_output_choices, null, 2));

client.capture(event);

setTimeout(async () => {
  await client.shutdown();
  console.log('\nSent. PostHog will NOT extract any tools from this event.');
  console.log('Check LLM Analytics -> Tools tab — nothing will appear.');
}, 3000);
