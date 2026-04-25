# Example 04: Multi-Agent Fitness Platform Orchestrator

## Overview

This example demonstrates a comprehensive multi-agent system for a fitness/health platform using the agent-orchestrator library. It showcases:

- **PRD Generator Agent**: Conflict detection, RICE scoring, Gherkin user stories
- **AI Engineer Agent**: RAG pipeline, prompt engineering, mental health protocols, bio-syncing
- **Automation Agent**: n8n workflows, notifications (Expo/Resend/WhatsApp), queue processing
- **Message Bus Architecture**: Redis Streams pattern for inter-agent communication
- **Multi-Level Memory System**: Working, Episodic, Semantic, and Procedural memory
- **Continuous Evolution**: Feedback loops with automatic evaluation and fine-tuning

## Key Features Implemented

### 1. PRD Generation with Gherkin Acceptance Criteria

```typescript
// Example output from PRD Agent
STORY-042: As a personal trainer,
I WANT to view the student's HRV in real time,
TO adjust training intensity

ACCEPTANCE CRITERIA:
✓ Given a student is wearing a compatible wearable
  When the trainer opens the live session view
  Then HRV data updates every 5 seconds
  And visual indicators show stress/recovery zones
```

### 2. Conflict Detection Protocol

The PRD Agent automatically:
- Flags requirements that contradict existing features
- Presents market data evidence for alternative approaches
- Alerts when feedback history shows similar failed attempts

### 3. RICE Scoring for Priority Matrix

Each feature receives scores for:
- **Reach**: How many users affected
- **Impact**: Effect on user experience/business
- **Confidence**: Certainty of estimates
- **Effort**: Development complexity

### 4. Mental Health Agent (Trauma-Informed Care)

Implements mandatory safety protocols:
- Emotional safety before intervention
- Trust through predictable responses
- User choice in micro-decisions
- Collaboration over imposition
- CVV (188) automatic provision for self-harm ideation

### 5. RAG Pipeline Configuration

Collections maintained:
- `exercises`: ExerciseDB + manual curation
- `physiology`: Exercise Physiology, Periodization
- `mental_health`: CBT, DBT, ACT adapted to fitness
- `nutrition`: Open Food Facts + SBME guidelines
- `user_profiles`: Individual history (anonymized)

Embedding model: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, local execution)

### 6. Bio-Syncing Integration

Data flow: `HealthKit/Google Fit → Redis Stream → LLM Context → Personalized Response`

Supported providers:
- Apple HealthKit (HRV, sleep, steps, heart rate)
- Google Fit REST API
- Oura API (OAuth2)
- Garmin Health API
- Fitbit Web API

### 7. Pose Estimation Module

- Model: MediaPipe MoveNet (Lightning variant)
- Format: TFLite (mobile) / CoreML (iOS)
- Inference: < 50ms on device NPU
- Privacy: Video frames NEVER leave device

### 8. Automation Workflows

**n8n Workflow Triggers:**
- `user.created` → welcome email + profile setup
- `biometric.alert` → notify trainer + adjust plan
- `payment.confirmed` → activate subscription + receipt

**Notification Channels:**
- Expo Push API (free, React Native)
- Resend API (3000 emails/month free)
- Evolution API (self-hosted WhatsApp)

**Scheduled Tasks:**
- Daily reminder: `0 8 * * *` (8 AM local time)
- Weekly summary: `0 18 * * 0` (Sunday 6 PM)
- Monthly report: `0 10 1 * *` (1st of month, 10 AM)

## Architecture Patterns

### Orchestration Pattern (Sequential)

```
Conductor → PRD_AI → AI_ENGINEER → AUTOMATION
                ↓           ↓            ↓
           PRD Doc    RAG Config   Workflows
           Stories    Prompts      Notifications
           RICE       Bio-sync     Queue Jobs
```

Used for complex flows requiring guaranteed order and dependencies.

### Choreography Pattern (Event-Driven)

```
user.created ──► Automation_Agent (welcome email)
              ──► Backend_Agent (create profile)
              ──► AI_Engineer (init memory)

biometric.alert ──► AI_Engineer (recalculate plan)
                 ──► Automation_Agent (notify trainer)

payment.confirmed ──► Backend_Agent (activate subscription)
                   ──► Automation_Agent (receipt + onboarding)
```

Used for independent events with high throughput requirements.

## Multi-Level Memory System

| Level | Name | Technology | Access Time | Use Case |
|-------|------|------------|-------------|----------|
| 1 | Working Memory | Redis (TTL: Session) | < 1ms | Current conversation context |
| 2 | Episodic Memory | Qdrant (Vector) | ~10ms | Semantic history, patterns |
| 3 | Semantic Memory | PostgreSQL | ~5ms | Profile, metrics, workouts |
| 4 | Procedural Memory | Prompt Registry (Git) | N/A | Versioned prompts, workflows |

## Continuous Evolution Cycle

1. **EXECUTION**: Agent produces output → delivered to user
2. **AUTOMATIC EVALUATION**: G-Eval + custom rubrics (relevance, coherence, safety, domain specificity)
3. **HUMAN FEEDBACK**: Thumbs up/down, 5-star, free text corrections
4. **DATASET CURATION**: Winning pairs → training set
5. **FINE-TUNING**: DSPy auto-optimizer for prompts, LoRA for small models
6. **VERSIONING**: Git tag → staging → A/B test → production

## Message Bus Protocol

```typescript
interface AgentMessage {
  // Identification
  message_id: string;        // UUID v4
  correlation_id: string;    // trace of original request
  trace_id: string;          // OpenTelemetry trace
  
  // Routing
  from_agent: AgentId;
  to_agent: AgentId | "broadcast";
  reply_to?: string;         // expected response stream
  
  // Content
  task_type: TaskType;
  priority: "critical" | "high" | "normal" | "low";
  payload: Record<string, unknown>;
  
  // Control
  timestamp: ISO8601String;
  ttl_seconds: number;       // message expiration
  retry_count: number;
  max_retries: number;
  
  // Metadata
  schema_version: string;    // contract versioning
  tags: string[];
}
```

Redis Streams:
- `agent.tasks` → tasks to perform
- `agent.results` → results produced
- `agent.errors` → failures and retries
- `agent.feedback` → quality assessments
- `system.events` → domain events

## Real-World Application Cases

### Case 1: Automatic App Generation (< 4 minutes)

Personal trainer requests: "I need an app for my gym with 50 students, online scheduling, and workout tracking."

**Execution Flow:**
- T+0s: Conductor receives request
- T+3s: PM Agent generates PRD with 12 user stories
- T+15s: UX Agent delivers wireframes + design tokens
- T+45s: Backend Agent delivers OpenAPI spec + DB schema
- T+120s: Frontend Agent delivers React components
- T+180s: QA Agent reports 0 critical bugs
- T+210s: DevOps Agent deploys to staging
- T+240s: **Functional preview available**

### Case 2: Mental Health Crisis Intervention (6 seconds)

Student message at 11 PM: "I can't get out of bed. Why keep training?"

**Execution Flow:**
- T+0s: Automation Agent detects message
- T+1s: AI Engineer retrieves history from Qdrant (low HRV × 5 days)
- T+2s: Builds enriched context with trauma-informed protocol
- T+3s: Generates 3-phase response (Acceptance → Exploration → Micro-commitment)
- T+4s: Response delivered + CVV provided
- T+5s: Trainer notified (silent push)
- T+6s: Interaction logged, workout reassigned to recovery

### Case 3: Real-Time Pose Correction (< 500ms)

Student records squat on mobile app.

**Execution Flow:**
- T+0ms: React Native accesses camera
- T+33ms: TFLite processes frame (30fps), detects knee angle 87° (target > 90°)
- T+50ms: Frontend Agent detects anomaly (spine flexion 15°)
- T+51ms: Red overlay + haptic vibration + audio cue
- T+100ms: Rep marked as "technical failure"
- T+200ms: Backend adjusts next set load (-5kg)
- T+500ms: Updated plan displayed

**All processed on-device. Zero network latency for critical detection.**

## Running the Example

```bash
# Ensure dependencies are installed
npm install

# Run the example (requires Claude CLI installed)
npx tsx examples/04-multi-agent-fitness-platform.ts
```

**Note:** This example demonstrates architecture and patterns. Actual execution requires:
- Claude CLI (`@anthropic-ai/claude-code`) installed globally
- Valid Anthropic API key
- Optional: Redis, Qdrant, PostgreSQL for full functionality

## Technology Stack Summary

| Category | Technology | License/Cost |
|----------|-----------|--------------|
| **Frontend** | React 19 + Vite, React Native 0.74+, Expo SDK 51+ | MIT / Free |
| **State** | Zustand 4 | MIT / Free |
| **Backend** | FastAPI (Python 3.12), PostgreSQL 16, Redis 7 | MIT / Free |
| **AI/LLM** | Anthropic Claude API, Ollama + Llama 3.1 | Paid / Free |
| **Embeddings** | all-MiniLM-L6-v2 | Apache 2 / Free |
| **Vector DB** | Qdrant (self-hosted) | Apache 2 / Free |
| **Orchestration** | LangGraph, CrewAI | MIT / Free |
| **Automation** | n8n (self-hosted) | Sustainable / Free |
| **Pose Estimation** | MediaPipe | Apache 2 / Free |
| **Notifications** | Expo Push, Resend (3k/mo free), Evolution API | Free tiers |
| **Observability** | Prometheus + Grafana, OpenTelemetry | Apache 2 / Free |

## Safety & Compliance

### Mental Health Safeguards
- Hard-coded safety triggers (cannot be bypassed by prompts)
- Mandatory CVV provision for self-harm detection
- Clarification of AI limitations in every session
- Psychologist review of 5% monthly sample
- PHI encrypted AES-256 before Qdrant indexing

### LGPD/GDPR Compliance
- Embeddings generated from anonymized text only
- UUID as identifier (never name or CPF)
- Right-to-erase: delete by user_id filter
- Data minimization: only essential biometrics stored

### Cost Controls
- Budget alerts on Anthropic API
- L2 cache for similar responses
- Ollama fallback for low-complexity tasks
- Circuit breaker on ALL external calls (mandatory lint rule)

## Next Steps

1. **Customize Agent Prompts**: Modify system prompts in agent configurations
2. **Set Up Infrastructure**: Deploy Redis, Qdrant, PostgreSQL
3. **Configure Integrations**: Add API keys for HealthKit, Resend, etc.
4. **Define Workflows**: Create n8n workflow JSON definitions
5. **Test Locally**: Run with Ollama for development (no API costs)
6. **Deploy to Production**: Use Docker + Kubernetes manifests in `/infra`

---

**Architecture designed for FitPro ecosystem · April 2026**  
*Recommended review every 6 months — AI market evolves rapidly.*
