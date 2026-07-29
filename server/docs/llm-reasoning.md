# LLM Usage Reasoning & Architectural Trade-offs

## AI Integration Purpose
LLMs are integrated into Froncort to parse pull requests, ticket histories, and organization activity to generate automated daily progress digests for managers and engineering leads.

## Security & Isolation Considerations
- **Context Boundaries**: To avoid context leakage, raw cross-org data is filtered prior to LLM prompt generation.
- **Deterministic Safeguards**: Relying solely on prompt engineering for data boundary enforcement is insufficient. Hard authorization filters at the API and database levels ensure non-accessible items never enter the prompt payload.

## Trade-offs & Pros/Cons
- **Pros**: Reduces manual status update overhead by automatically digesting sprint activities.
- **Cons**: Requires strict pre-filtering logic to prevent sensitive internal ticket descriptions from reaching third-party LLM endpoints.