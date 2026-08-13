// The real Brain. Only called when OPENAI_API_KEY is set. Uses function
// calling so the model's only way to act is through a fixed, typed tool —
// it can describe a change, but it can never produce anything the Rulebook
// wasn't already prepared to validate.

import OpenAI from 'openai'

let client = null
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

const PROPOSE_RULE_TOOL = {
  type: 'function',
  function: {
    name: 'propose_rule',
    description:
      'Propose a UI change for the current user on the current page. Only call this when you are confident which single anchor the user means.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['hide', 'show', 'restyle', 'redirect'] },
        target: {
          type: 'string',
          description: 'The anchor id from the provided list. Required for hide, show and restyle.',
        },
        style: {
          type: 'object',
          description: 'CSS properties to apply. Only used when action is restyle.',
          additionalProperties: { type: 'string' },
        },
        redirectTo: {
          type: 'string',
          description: 'Path to redirect to. Only used when action is redirect.',
        },
      },
      required: ['action'],
    },
  },
}

// Backend tools are exposed to the model as their own named functions,
// `tool_<slug>`, using the owner's own input_schema — the model picks
// whichever one fits and fills its args directly, same as propose_rule.
function toolFunctionName(slug) {
  return `tool_${slug}`
}

function backendToolDefs(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: toolFunctionName(t.slug),
      description: t.description || t.name,
      parameters: t.inputSchema && Object.keys(t.inputSchema).length ? t.inputSchema : { type: 'object', properties: {} },
    },
  }))
}

export async function planWithOpenAI({ message, route, clickedAnchor, anchors, existingRules, history = [], tools = [] }) {
  const system = buildSystemPrompt({ route, clickedAnchor, anchors, existingRules, hasHistory: history.length > 0, tools })

  const res = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message },
    ],
    tools: [PROPOSE_RULE_TOOL, ...backendToolDefs(tools)],
    tool_choice: 'auto',
  })

  const choice = res.choices[0]
  const toolCall = choice.message.tool_calls?.[0]

  if (toolCall && toolCall.function.name === 'propose_rule') {
    try {
      const args = JSON.parse(toolCall.function.arguments)
      return { proposal: args }
    } catch {
      return { reply: "Sorry, I couldn't work out a clean change from that — could you rephrase?" }
    }
  }

  if (toolCall) {
    const tool = tools.find((t) => toolFunctionName(t.slug) === toolCall.function.name)
    if (tool) {
      try {
        const args = JSON.parse(toolCall.function.arguments || '{}')
        return { toolCall: { slug: tool.slug, args } }
      } catch {
        return { reply: "Sorry, I couldn't work out the details for that — could you rephrase?" }
      }
    }
  }

  return { reply: choice.message.content || "I'm not sure how to do that yet." }
}

function buildSystemPrompt({ route, clickedAnchor, anchors, existingRules, hasHistory, tools = [] }) {
  const anchorList = anchors
    .map((a) => {
      if (!a.locked) return `- ${a.key}: ${a.name} — ${a.description}`
      return `- ${a.key}: ${a.name} — ${a.description} (protected — never target this. If the user asks, decline using this exact reason, word for word: "${a.lockReason}")`
    })
    .join('\n')

  const existing = existingRules.length
    ? existingRules.map((r) => `- ${r.action} on ${r.targetName || r.target}`).join('\n')
    : '(none)'

  return [
    'You are the planner for UXaura, a tool that lets one user personalize a web app by asking in plain language.',
    'You only ever change presentation for this one user, on this one page, or call one of the backend tools below. You never write code or produce anything outside those tools.',
    'Only call propose_rule when you are confident which single anchor the user means, using only ids from the list below. Never invent an id.',
    tools.length
      ? 'Only call a backend tool when the request clearly matches what it does and you have every required argument. Never invent argument values the user did not provide — ask for anything missing instead.'
      : null,
    'If it is ambiguous, or the user is asking a question rather than requesting a change, reply in plain text instead of calling a tool — ask a short clarifying question, or invite them to switch on "point at it" and click the element.',
    "If the user's existing rules already do something that conflicts with this request, mention it in your reply and ask before proposing a new one, instead of calling the tool.",
    hasHistory
      ? 'The messages below include the recent conversation on this page. A short reply like "yes" refers back to your last question — resolve it using that context instead of asking again. When a past user message starts with "(pointed at: some-anchor-id)", that records what they had clicked at that point in the conversation.'
      : null,
    '',
    `Current page: ${route}`,
    clickedAnchor ? `The user just clicked on: ${clickedAnchor}` : 'The user has not clicked on anything.',
    '',
    'Anchors available on this page:',
    anchorList,
    '',
    "This user's existing rules on this page:",
    existing,
    tools.length ? '' : null,
    tools.length ? 'Backend tools available:' : null,
    tools.length ? tools.map((t) => `- ${t.name}: ${t.description}`).join('\n') : null,
  ]
    .filter((line) => line !== null)
    .join('\n')
}
