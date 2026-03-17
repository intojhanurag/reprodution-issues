/**
 * AFTER fix: Simulates what the fixed PosthogExporter sends to PostHog.
 *
 * The span output now includes toolCalls, and formatMessages() converts them
 * to PostHog's expected tool-call content block format. PostHog's ingestion
 * extracts tool names and populates the Tools tab.
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
  distinctId: 'repro-14135-after',
  event: '$ai_generation',
  properties: {
    $ai_trace_id: 'trace-14135-after-' + Date.now(),
    $ai_span_id: 'span-14135-after-' + Date.now(),
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
    // FIXED: structured tool-call content blocks that PostHog can parse
    $ai_output_choices: [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            id: 'call_e2e_abc123',
            function: {
              name: 'get_weather',
              arguments: { city: 'Paris' },
            },
          },
        ],
      },
    ],
  },
};

console.log('Sending AFTER (fixed) event...');
console.log('$ai_output_choices:', JSON.stringify(event.properties.$ai_output_choices, null, 2));

client.capture(event);

setTimeout(async () => {
  await client.shutdown();
  console.log('\nSent. PostHog WILL extract "get_weather" from this event.');
  console.log('Check LLM Analytics -> Tools tab — "get_weather" should appear.');
}, 3000);
