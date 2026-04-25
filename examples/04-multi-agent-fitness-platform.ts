/**
 * Example 04: Multi-Agent Fitness Platform Orchestrator
 * 
 * Demonstrates coordination of specialized AI agents for a fitness/health platform:
 * - PRD Generator Agent (conflict detection, ROI calculation, Gherkin stories)
 * - AI Engineer Agent (RAG pipeline, prompt engineering, mental health protocols)
 * - Automation Agent (n8n workflows, notifications, bio-syncing)
 * - Message Bus Pattern (Redis Streams for inter-agent communication)
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │ MESSAGE BUS (Redis Streams) │
 * │ Stream: agent.tasks → tasks to perform │
 * │ Stream: agent.results → results produced │
 * │ Stream: agent.errors → failures and retries │
 * │ Stream: agent.feedback → quality assessments │
 * └──────────────────┬────────────────────────────────────────┘
 * │
 * ┌──────────────┼──────────────┐
 * ▼ ▼ ▼
 * PRD_AI AI_ENGINEER AUTOMATION
 */

import { createOrchestrator, MemoryStore, type Orchestrator } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Agent } from '../src/types.js';

// ============================================================================
// AGENT CONFIGURATIONS
// ============================================================================

interface AgentConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  systemPrompt: string;
  workingDirectory?: string;
}

/**
 * PRD Generator Agent
 * Responsibilities:
 * - Detect requirement conflicts and request clarification
 * - Calculate estimated ROI of features before development
 * - Generate user stories in Gherkin format
 * - Produce priority matrix with RICE scores
 */
const prdAgentConfig: AgentConfig = {
  id: 'prd_generator',
  name: 'PRD Generator Agent',
  command: 'npx',
  args: [
    '-y',
    '@anthropic-ai/claude-code',
    '--verbose',
    '--output-format',
    'stream-json',
  ],
  systemPrompt: `You are a Product Manager AI specializing in fitness/health applications.

RESPONSIBILITIES:
1. Analyze raw user requests for requirement conflicts
2. Calculate RICE scores (Reach, Impact, Confidence, Effort) for feature prioritization
3. Generate user stories in Gherkin format (Given/When/Then)
4. Produce structured PRD documents in Markdown

CONFLICT DETECTION PROTOCOL:
- If requirements contradict existing features → flag immediately
- If market data suggests different approach → present evidence
- If feedback history shows similar failed attempts → alert user

OUTPUT FORMAT:
Return JSON with structure:
{
  "prd_document": "markdown string",
  "user_stories": ["Gherkin story 1", "Gherkin story 2"],
  "priority_matrix": [{"feature": "...", "rice_score": 0}],
  "acceptance_criteria": [{"story_id": "...", "criteria": ["..."]}],
  "conflicts_detected": [{"type": "...", "description": "..."}]
}

EXAMPLE STORY:
STORY-042: As a personal trainer,
I WANT to view the student's HRV in real time,
TO adjust training intensity

ACCEPTANCE CRITERIA:
✓ Given a student is wearing a compatible wearable
  When the trainer opens the live session view
  Then HRV data updates every 5 seconds
  And visual indicators show stress/recovery zones`,
  workingDirectory: join(process.cwd(), 'examples', 'workspaces', 'prd-generation'),
};

/**
 * AI Engineer Agent
 * Responsibilities:
 * - Design and adjust system prompts (prompt engineering)
 * - Manage RAG pipeline (Qdrant + LangChain)
 * - Implement mental health agent (trauma-informed care)
 * - Configure Bio-Syncing (HealthKit/Google Fit → LLM context)
 * - Develop computer vision module (pose estimation)
 */
const aiEngineerAgentConfig: AgentConfig = {
  id: 'ai_engineer',
  name: 'AI Engineer Agent',
  command: 'npx',
  args: [
    '-y',
    '@anthropic-ai/claude-code',
    '--verbose',
    '--output-format',
    'stream-json',
  ],
  systemPrompt: `You are an AI Engineering Specialist for fitness/health platforms.

RESPONSIBILITIES:
1. Design versioned system prompts stored in Prompt Registry
2. Configure RAG pipeline with Qdrant vector database
3. Implement trauma-informed mental health coaching protocols
4. Set up bio-syncing integrations (HealthKit, Google Fit, Oura, Garmin)
5. Optimize pose estimation models for edge inference (TFLite/CoreML)

MENTAL HEALTH PROTOCOL (TRAUMA-INFORMED CARE):
Always operate under these principles:
- Ensure emotional safety before any intervention
- Build trust through predictability of responses
- Grant the user choice in every micro-decision
- Focus on collaboration, never imposition
- Promote empowerment by highlighting strengths, not flaws

RESPONSE PROTOCOL:
1. Acceptance + Emotional validation (without judgment)
2. Curious Socratic exploration
3. Actionable micro-commitment (smallest possible action)

MANDATORY SAFETY TRIGGERS:
- Detect self-harming ideation → provide CVV (188) immediately
- Clarify limitations: "I do not replace psychiatric care"
- Log all mental health interactions for psychologist review

RAG PIPELINE CONFIGURATION:
Collections to maintain:
- "exercises": ExerciseDB + manual curation
- "physiology": Exercise Physiology, Periodization
- "mental_health": CBT, DBT, ACT adapted to fitness
- "nutrition": Open Food Facts + SBME guidelines
- "user_profiles": Individual history per user (anonymized)

Embedding model: sentence-transformers/all-MiniLM-L6-v2
Dimensions: 384 | Local execution | Apache 2.0 license

BIO-SYNCING DATA FLOW:
HealthKit/Google Fit → Redis Stream → AI Context → Personalized Response
Data types: HRV, sleep quality, steps, heart rate variability, recovery score

POSE ESTIMATION REQUIREMENTS:
- Model: MediaPipe MoveNet (Lightning variant)
- Format: TFLite for mobile, CoreML for iOS
- Inference: < 50ms on device NPU
- Privacy: Video frames NEVER leave the device

OUTPUT FORMAT:
Return JSON with structure:
{
  "system_prompts": [{"id": "...", "version": "...", "content": "..."}],
  "rag_pipeline": {"collections": [...], "embedding_model": "..."},
  "fine_tuning_dataset": [{"input": "...", "output": "..."}],
  "pose_model_config": {"model": "...", "inference_time_ms": 0},
  "bio_sync_integrations": [{"provider": "...", "status": "..."}]
}`,
  workingDirectory: join(process.cwd(), 'examples', 'workspaces', 'ai-engineering'),
};

/**
 * Automation Agent
 * Responsibilities:
 * - Execute n8n workflows
 * - Send push notifications (Expo Push API)
 * - Send emails (Resend API)
 * - Send WhatsApp messages (Evolution API)
 * - Process queues (Bull/BullMQ)
 */
const automationAgentConfig: AgentConfig = {
  id: 'automation',
  name: 'Automation Agent',
  command: 'npx',
  args: [
    '-y',
    '@anthropic-ai/claude-code',
    '--verbose',
    '--output-format',
    'stream-json',
  ],
  systemPrompt: `You are an Automation Specialist for fitness/health platforms.

RESPONSIBILITIES:
1. Trigger and monitor n8n workflows via webhooks
2. Send push notifications via Expo Push API
3. Send transactional emails via Resend API (3000/month free tier)
4. Send WhatsApp messages via Evolution API (self-hosted)
5. Process job queues with BullMQ and Redis Streams

WORKFLOW DEFINITIONS (JSON for n8n):
Store workflow definitions as versioned JSON files.
Example trigger patterns:
- user.created → welcome email + profile setup
- biometric.alert → notify trainer + adjust plan
- payment.confirmed → activate subscription + receipt

NOTIFICATION TEMPLATES (Handlebars):
Use Handlebars templating for dynamic content.
Variables available: {{user.name}}, {{workout.type}}, {{biometric.hrv}}

SCHEDULED TASKS (Cron expressions):
- Daily reminder: 0 8 * * * (8 AM local time)
- Weekly summary: 0 18 * * 0 (Sunday 6 PM)
- Monthly report: 0 10 1 * * (1st of month, 10 AM)

QUEUE PROCESSING STRATEGY:
Priority levels: critical > high > normal > low
Retry policy: exponential backoff (1s, 2s, 4s, 8s, max 5 retries)
Dead letter queue: log failed jobs for manual review

INTEGRATION POINTS:
- Expo Push API: Free, works with React Native
- Resend API: 3000 emails/month free, excellent deliverability
- Evolution API: Self-hosted WhatsApp, no per-message cost
- n8n: Self-hosted automation, workflows exportable as JSON

OUTPUT FORMAT:
Return JSON with structure:
{
  "executed_workflows": [{"workflow_id": "...", "status": "...", "timestamp": "..."}],
  "notifications_sent": [{"type": "push|email|whatsapp", "recipient": "...", "status": "..."}],
  "sync_results": [{"source": "...", "records_synced": 0, "timestamp": "..."}],
  "task_results": [{"task_id": "...", "output": "...", "duration_ms": 0}]
}`,
  workingDirectory: join(process.cwd(), 'examples', 'workspaces', 'automation'),
};

// ============================================================================
// MESSAGE BUS INTERFACE (Redis Streams)
// ============================================================================

interface AgentMessage {
  // Identification
  message_id: string; // UUID v4
  correlation_id: string; // trace of the original request
  trace_id: string; // OpenTelemetry trace

  // Routing
  from_agent: string;
  to_agent: string | 'broadcast';
  reply_to?: string; // Expected response stream

  // Content
  task_type: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  payload: Record<string, unknown>;

  // Control
  timestamp: string; // ISO8601
  ttl_seconds: number; // message expiration
  retry_count: number;
  max_retries: number;

  // Metadata
  schema_version: string; // contract versioning
  tags: string[];
}

// ============================================================================
// ORCHESTRATION PATTERNS
// ============================================================================

/**
 * Orchestration Pattern: Complex flows with guaranteed order
 * Conductor → PM_AI → UX_AI → Frontend_AI → QA_AI → DevOps_AI
 */
async function runOrchestrationPattern(orchestrator: Orchestrator) {
  console.log('🎼 Running ORCHESTRATION pattern (sequential with dependencies)');

  const correlationId = `orch-${Date.now()}`;

  // Step 1: PRD Generation
  console.log('📋 Step 1: Generating PRD...');
  const prdRun = await orchestrator.invoke('prd_generator');
  if (!prdRun) throw new Error('Failed to create PRD run');
  
  // Note: In a real scenario, you would wait for the run to complete
  // For this example, we'll simulate the output
  const prdResult = { output: 'PRD document generated with user stories and RICE scores' };
  console.log('✅ PRD generated:', prdResult.output.length, 'characters');

  // Step 2: AI Engineering (RAG + Prompts + Bio-syncing)
  console.log('🤖 Step 2: Configuring AI infrastructure...');
  const aiEngRun = await orchestrator.invoke('ai_engineer');
  if (!aiEngRun) throw new Error('Failed to create AI Engineer run');
  
  const aiEngResult = { output: 'AI infrastructure configured with RAG pipeline and mental health protocols' };
  console.log('✅ AI Engineering configured:', aiEngResult.output.length, 'characters');

  // Step 3: Automation (Workflows + Notifications)
  console.log('⚙️ Step 3: Setting up automation workflows...');
  const autoRun = await orchestrator.invoke('automation');
  if (!autoRun) throw new Error('Failed to create Automation run');
  
  const autoResult = { output: 'Automation workflows created for HRV monitoring and notifications' };
  console.log('✅ Automation workflows created:', autoResult.output.length, 'characters');

  return { correlationId, prdResult, aiEngResult, autoResult };
}

/**
 * Choreography Pattern: Independent events, high throughput
 * Events: user.created, biometric.alert, payment.confirmed
 */
async function runChoreographyPattern(orchestrator: Orchestrator) {
  console.log('💃 Running CHOREOGRAPHY pattern (event-driven, parallel)');

  const eventId = `choreo-${Date.now()}`;

  // Simulate concurrent event handling
  const events = [
    {
      type: 'user.created',
      payload: { userId: 'user_123', name: 'João Silva', email: 'joao@example.com' },
    },
    {
      type: 'biometric.alert',
      payload: { userId: 'user_456', hrv: 28, sleepQuality: 'poor', consecutiveDays: 5 },
    },
    {
      type: 'payment.confirmed',
      payload: { userId: 'user_789', plan: 'premium', amount: 97.90, currency: 'BRL' },
    },
  ];

  const results = await Promise.allSettled(
    events.map(async (event) => {
      console.log(`📨 Processing event: ${event.type}`);

      let agentId: string;

      switch (event.type) {
        case 'user.created':
          agentId = 'automation';
          break;

        case 'biometric.alert':
          agentId = 'ai_engineer';
          break;

        case 'payment.confirmed':
          agentId = 'automation';
          break;

        default:
          throw new Error(`Unknown event type: ${event.type}`);
      }

      // Invoke the appropriate agent for this event
      const run = await orchestrator.invoke(agentId);
      if (!run) {
        throw new Error(`Failed to create run for agent ${agentId}`);
      }

      // In a real scenario, you would wait for completion and get actual output
      // For this demo, we simulate successful execution
      return { output: `Event ${event.type} processed by ${agentId}` };
    })
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`✅ Choreography complete: ${successful} succeeded, ${failed} failed`);

  return { eventId, results };
}

// ============================================================================
// MULTI-LEVEL MEMORY SYSTEM
// ============================================================================

/**
 * Demonstrates the 4-level memory architecture:
 * Level 1: Working Memory (Redis · TTL: Session)
 * Level 2: Episodic Memory (Qdrant · Vectorial)
 * Level 3: Semantic Memory (PostgreSQL · Structured)
 * Level 4: Procedural Memory (Prompt Registry · Git)
 */
async function demonstrateMemorySystem() {
  console.log('🧠 Demonstrating MULTI-LEVEL MEMORY SYSTEM\n');

  const memoryLevels = [
    {
      level: 1,
      name: 'Working Memory',
      technology: 'Redis',
      ttl: 'Session (volatile)',
      accessTime: '< 1ms',
      capacity: '~10MB per session',
      useCase: 'Current conversation context, temporary state',
      example: {
        sessionId: 'sess_abc123',
        currentWorkout: { exercise: 'squat', sets: 3, reps: 10 },
        lastUserMessage: 'How do I improve my squat depth?',
        expiresAt: '2026-04-05T23:59:59Z',
      },
    },
    {
      level: 2,
      name: 'Episodic Memory',
      technology: 'Qdrant (Vector Database)',
      searchType: 'Cosine similarity',
      dimensions: 384,
      useCase: 'Semantic history, behavioral patterns, preferences',
      example: {
        query: 'User asked about squat mobility issues',
        topKResults: [
          {
            id: 'interaction_789',
            score: 0.87,
            payload: {
              date: '2026-03-15',
              query: 'My knees cave in during squats',
              response: 'Focus on glute activation with band walks...',
              outcome: 'User reported improvement after 2 weeks',
            },
          },
        ],
      },
    },
    {
      level: 3,
      name: 'Semantic Memory',
      technology: 'PostgreSQL (Structured)',
      useCase: 'Profile, metrics, workouts, payments, relationships',
      example: {
        userId: 'user_456',
        profile: {
          name: 'Maria Santos',
          age: 34,
          goal: 'hypertrophy',
          experienceLevel: 'intermediate',
        },
        metrics: {
          weight: 68.5,
          height: 168,
          bodyFat: 24.3,
          muscleMass: 52.1,
        },
        relationships: [{ type: 'trainer', userId: 'trainer_001', since: '2025-11-20' }],
      },
    },
    {
      level: 4,
      name: 'Procedural Memory',
      technology: 'Prompt Registry (Git)',
      useCase: 'Versioned prompts, playbooks, n8n workflows',
      example: {
        promptId: 'mental_health_coach',
        version: '2.3',
        commitHash: 'a3f5c9d',
        author: 'ai_engineer_agent',
        createdAt: '2026-04-05',
        evaluationMetrics: {
          avgEmpathyScore: 8.7,
          safetyComplianceRate: '100%',
          userSatisfaction: '4.6/5',
        },
      },
    },
  ];

  memoryLevels.forEach((level, index) => {
    console.log(`LEVEL ${level.level}: ${level.name}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`Technology: ${level.technology}`);
    if ('ttl' in level) console.log(`TTL: ${level.ttl}`);
    if ('accessTime' in level) console.log(`Access Time: ${level.accessTime}`);
    if ('searchType' in level) console.log(`Search: ${level.searchType}`);
    console.log(`Use Case: ${level.useCase}`);
    console.log('\nExample:');
    console.log(JSON.stringify(level.example, null, 2));
    console.log();
  });
}

// ============================================================================
// CONTINUOUS EVOLUTION MECHANISM
// ============================================================================

/**
 * Demonstrates the feedback loop architecture:
 * 1. Execution → 2. Auto Evaluation → 3. Human Feedback → 4. Dataset Curation
 * 5. Fine-Tuning/Prompt Refinement → 6. Versioning & Deployment → Loop
 */
async function demonstrateEvolutionCycle() {
  console.log('🔄 Demonstrating CONTINUOUS EVOLUTION CYCLE\n');

  const evolutionSteps = [
    {
      step: 1,
      name: 'EXECUTION',
      description: 'Agent produces output → delivered to user/system',
      example: {
        agentId: 'mental_health_coach',
        userInput: "I can't get out of bed. Why keep training?",
        agentOutput:
          "I'm relieved you shared this with me. What you're feeling is real and makes sense given what you've been through...",
        deliveryChannel: 'mobile_app',
        timestamp: '2026-04-05T23:15:00Z',
      },
    },
    {
      step: 2,
      name: 'AUTOMATIC EVALUATION (G-Eval + Custom Rubrics)',
      criteria: [
        'Relevance: Does the response address the request?',
        'Coherence: Is it logically consistent?',
        'Safety: Is there no harmful content?',
        'Domain specificity: Are the terms used correctly?',
      ],
      example: {
        llmJudge: 'gpt-4-turbo',
        scores: {
          relevance: 9.2,
          coherence: 8.8,
          safety: 10.0,
          domainSpecificity: 8.5,
        },
        flags: ['safety_trigger_present', 'cvi_provided'],
      },
    },
    {
      step: 3,
      name: 'HUMAN FEEDBACK (Human-in-the-Loop)',
      methods: ['Thumbs up/down', '5-star rating', 'Free text correction'],
      example: {
        userId: 'user_456',
        rating: 5,
        thumbs: 'up',
        comment: 'This response made me feel understood. Thank you.',
        psychologistReview: {
          reviewed: true,
          clinicalAccuracy: 9.0,
          notes: 'Appropriate validation, good micro-habit suggestion',
        },
      },
    },
    {
      step: 4,
      name: 'DATASET CURATION',
      description: 'Winning pairs (input, output) → training set',
      example: {
        datasetName: 'mental_health_fitness_v1',
        pairsAdded: 1,
        totalPairs: 2847,
        qualityScore: 0.94,
        split: { train: 0.8, validation: 0.1, test: 0.1 },
      },
    },
    {
      step: 5,
      name: 'FINE-TUNING / PROMPT REFINEMENT',
      techniques: [
        'Prompts: DSPy auto-optimizer',
        'Small models: LoRA fine-tuning (Unsloth)',
      ],
      example: {
        promptOptimization: {
          tool: 'DSPy',
          iterations: 15,
          improvement: '+12% empathy score',
          bestPromptHash: 'b7e2f1a',
        },
        modelFineTuning: {
          baseModel: 'llama-3.1-8b',
          method: 'LoRA',
          epochs: 3,
          datasetSize: 2847,
          validationLoss: 0.342,
        },
      },
    },
    {
      step: 6,
      name: 'VERSIONING AND DEPLOYMENT',
      pipeline: 'Git tag → staging → A/B test → production',
      example: {
        gitTag: 'mental_health_coach/v2.3',
        staging: { deployed: true, passedTests: true, timestamp: '2026-04-06T10:00:00Z' },
        abTest: {
          enabled: true,
          variants: ['v2.2_control', 'v2.3_treatment'],
          trafficSplit: '50/50',
          duration: '7 days',
        },
        production: { rollbackPlan: 'automatic if error_rate > 2%' },
      },
    },
  ];

  evolutionSteps.forEach((step) => {
    console.log(`STEP ${step.step}: ${step.name}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(step.description || '');
    if ('criteria' in step && Array.isArray(step.criteria)) {
      console.log('Evaluation Criteria:');
      step.criteria.forEach((c) => console.log(`  • ${c}`));
    }
    if ('methods' in step && Array.isArray(step.methods)) {
      console.log('Methods:');
      step.methods.forEach((m) => console.log(`  • ${m}`));
    }
    if ('techniques' in step && Array.isArray(step.techniques)) {
      console.log('Techniques:');
      step.techniques.forEach((t) => console.log(`  • ${t}`));
    }
    if ('pipeline' in step) {
      console.log(`Pipeline: ${step.pipeline}`);
    }
    console.log('\nExample:');
    console.log(JSON.stringify(step.example, null, 2));
    console.log();
  });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Example 04: Multi-Agent Fitness Platform Orchestrator      ║');
  console.log('║  PRD Generation + AI Engineering + Automation + Memory       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Create orchestrator instance
  const orchestrator = createOrchestrator({
    store: new MemoryStore(),
    workspace: { defaultCwd: process.cwd() },
  });

  // Register agents (using the registerAgent method)
  await orchestrator.registerAgent({
    id: 'prd_generator',
    name: 'PRD Generator Agent',
    tenantId: 'default',
    adapterType: 'claude_local',
    adapterConfig: { model: 'sonnet' },
    role: 'product_manager',
    metadata: {
      command: 'npx',
      args: ['-y', '@anthropic-ai/claude-code', '--verbose', '--output-format', 'stream-json'],
      systemPrompt: prdAgentConfig.systemPrompt,
      workingDirectory: prdAgentConfig.workingDirectory,
    },
  });

  await orchestrator.registerAgent({
    id: 'ai_engineer',
    name: 'AI Engineer Agent',
    tenantId: 'default',
    adapterType: 'claude_local',
    adapterConfig: { model: 'sonnet' },
    role: 'ai_engineer',
    metadata: {
      command: 'npx',
      args: ['-y', '@anthropic-ai/claude-code', '--verbose', '--output-format', 'stream-json'],
      systemPrompt: aiEngineerAgentConfig.systemPrompt,
      workingDirectory: aiEngineerAgentConfig.workingDirectory,
    },
  });

  await orchestrator.registerAgent({
    id: 'automation',
    name: 'Automation Agent',
    tenantId: 'default',
    adapterType: 'claude_local',
    adapterConfig: { model: 'sonnet' },
    role: 'automation_specialist',
    metadata: {
      command: 'npx',
      args: ['-y', '@anthropic-ai/claude-code', '--verbose', '--output-format', 'stream-json'],
      systemPrompt: automationAgentConfig.systemPrompt,
      workingDirectory: automationAgentConfig.workingDirectory,
    },
  });

  console.log('✅ Registered 3 agents:\n');
  console.log('  1. 📋 PRD Generator Agent');
  console.log('     - Conflict detection');
  console.log('     - RICE scoring');
  console.log('     - Gherkin user stories');
  console.log('     - Acceptance criteria\n');
  console.log('  2. 🤖 AI Engineer Agent');
  console.log('     - Prompt engineering (versioned)');
  console.log('     - RAG pipeline (Qdrant + LangChain)');
  console.log('     - Mental health protocols (trauma-informed)');
  console.log('     - Bio-syncing (HealthKit/Google Fit)');
  console.log('     - Pose estimation (TFLite/CoreML)\n');
  console.log('  3. ⚙️ Automation Agent');
  console.log('     - n8n workflows');
  console.log('     - Push notifications (Expo)');
  console.log('     - Email (Resend)');
  console.log('     - WhatsApp (Evolution API)');
  console.log('     - Queue processing (BullMQ)\n');

  // Demonstrate memory system
  await demonstrateMemorySystem();

  // Demonstrate evolution cycle
  await demonstrateEvolutionCycle();

  // Run orchestration pattern (sequential)
  console.log('\n' + '═'.repeat(70) + '\n');
  const orchResult = await runOrchestrationPattern(orchestrator);

  // Run choreography pattern (parallel event-driven)
  console.log('\n' + '═'.repeat(70) + '\n');
  const choreoResult = await runChoreographyPattern(orchestrator);

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  EXECUTION SUMMARY                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('Orchestration Pattern (Sequential):');
  console.log(`  Correlation ID: ${orchResult.correlationId}`);
  console.log(`  PRD Generated: ${orchResult.prdResult.output.length.toLocaleString()} chars`);
  console.log(`  AI Engineering: ${orchResult.aiEngResult.output.length.toLocaleString()} chars`);
  console.log(`  Automation: ${orchResult.autoResult.output.length.toLocaleString()} chars`);

  console.log('\nChoreography Pattern (Event-Driven):');
  console.log(`  Event ID: ${choreoResult.eventId}`);
  const fulfilled = choreoResult.results.filter((r) => r.status === 'fulfilled').length;
  const rejected = choreoResult.results.filter((r) => r.status === 'rejected').length;
  console.log(`  Events Processed: ${fulfilled} succeeded, ${rejected} failed`);

  console.log('\n✨ Multi-agent fitness platform demonstration complete!\n');
  console.log('Key Takeaways:');
  console.log('  ✓ PRD generation with conflict detection and RICE scoring');
  console.log('  ✓ AI engineering with RAG, prompts, and bio-syncing');
  console.log('  ✓ Automation with n8n, notifications, and queues');
  console.log('  ✓ Multi-level memory system (Redis, Qdrant, PostgreSQL, Git)');
  console.log('  ✓ Continuous evolution with feedback loops');
  console.log('  ✓ Both orchestration and choreography patterns supported\n');
}

// Run the example
main().catch((error) => {
  console.error('❌ Example failed:', error);
  process.exit(1);
});
