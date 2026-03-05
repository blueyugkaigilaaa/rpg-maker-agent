# RPG Maker Agent

Turn any article into a playable RPG Maker MZ game using AI.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# Start development server
npm run dev
```

Open http://localhost:3000, paste an article, and click "Generate Game".

## How It Works

The pipeline processes your article through 6 AI-powered stages:

1. **Text Analyzer** - Extracts characters, locations, timeline, emotional arc
2. **Game Designer** - Creates anchor events, decision nodes, game flow
3. **Scene Planner** - Plans 5-10 map scenes with connections
4. **Scene Builder** - Creates detailed events, NPCs, dialogues for each scene
5. **Asset Mapper** - Maps characters/scenes to RPG Maker MZ built-in assets
6. **RPG Maker Adapter** - Generates actual MZ project files (JSON)

The output is a complete RPG Maker MZ project that can be:
- Opened directly in RPG Maker MZ editor
- Deployed as an HTML5 web game
- Downloaded as a ZIP file

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | (required) |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Model to use | `gpt-4o` |
| `RPGMAKER_TEMPLATE_PATH` | Path to MZ template project | `newdata` |
| `RPGMAKER_SAMPLEMAPS_PATH` | Path to sample maps | `samplemaps` |

## Project Structure

```
src/
├── app/                    # Next.js pages and API routes
│   ├── page.tsx            # Home - article input
│   ├── generate/[id]/      # Generation progress + results
│   └── api/                # REST API endpoints
├── pipeline/               # AI pipeline modules
│   ├── types.ts            # Intermediate data types
│   ├── orchestrator.ts     # Pipeline orchestration
│   ├── text-analyzer.ts    # Module 1: Text analysis
│   ├── game-designer.ts    # Module 2: Game design
│   ├── scene-planner.ts    # Module 3: Scene planning
│   ├── scene-builder.ts    # Module 4: Scene building
│   ├── asset-mapper.ts     # Module 5: Asset mapping
│   └── rpgmaker-adapter.ts # Module 6: MZ project generation
├── rpgmaker/               # RPG Maker MZ utilities
│   ├── types.ts            # MZ JSON type definitions
│   ├── constants.ts        # Event command codes
│   ├── event-builder.ts    # Fluent event command builder
│   ├── map-builder.ts      # Map data utilities
│   ├── project-builder.ts  # Full project assembler
│   └── asset-catalog.ts    # Built-in asset index
├── llm/
│   └── client.ts           # OpenAI SDK wrapper
└── lib/
    └── store.ts            # In-memory pipeline state store
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4o
- **Output**: RPG Maker MZ (JSON project files)
