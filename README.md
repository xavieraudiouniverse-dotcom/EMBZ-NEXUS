# Embz Nexus 🚀

A Node.js integration for OpenAI's ChatGPT and Codex APIs, providing chat completions and code generation capabilities.

## Features

- **ChatGPT Integration** - Chat with GPT models via REST API
- **Code Completion** - Generate code snippets using Codex
- **Express Server** - Built-in Express.js server for easy deployment
- **Environment Configuration** - Secure API key management with `.env`
- **Error Handling** - Comprehensive error handling and logging

## Prerequisites

- Node.js 14+
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))

## Installation

1. Clone the repository:
```bash
git clone https://github.com/xavieraudiouniverse-dotcom/embz-nexus.git
cd embz-nexus
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from template:
```bash
cp .env.example .env
```

4. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=sk-...your-key-here...
```

## Usage

### Start the server
```bash
npm start
```

The server will run on `http://localhost:3000`

### Chat Endpoint

**POST** `/api/chat`

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the capital of France?",
    "model": "gpt-3.5-turbo"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "The capital of France is Paris.",
  "model": "gpt-3.5-turbo",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

### Code Completion Endpoint

**POST** `/api/code-completion`

```bash
curl -X POST http://localhost:3000/api/code-completion \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a function that adds two numbers",
    "language": "javascript",
    "model": "gpt-3.5-turbo"
  }'
```

**Response:**
```json
{
  "success": true,
  "code": "function add(a, b) {\n  return a + b;\n}",
  "language": "javascript",
  "model": "gpt-3.5-turbo"
}
```

### Health Check

**GET** `/health`

```bash
curl http://localhost:3000/health
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `OPENAI_ORG_ID` - Optional organization ID
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default: 3000)

## Available Models

- `gpt-4` - Most capable model
- `gpt-3.5-turbo` - Fast and efficient
- `text-davinci-003` - Legacy Codex model

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## API Documentation

### Parameters

#### Chat Endpoint
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | The message to send to ChatGPT |
| `model` | string | No | Model to use (default: `gpt-3.5-turbo`) |

#### Code Completion Endpoint
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | The code prompt/description |
| `language` | string | No | Programming language (default: `javascript`) |
| `model` | string | No | Model to use (default: `gpt-3.5-turbo`) |

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad request (missing parameters)
- `500` - Server error

Error response format:
```json
{
  "error": "Error message describing what went wrong"
}
```

## Contributing

Pull requests are welcome! Feel free to open issues for bugs or feature requests.

## License

MIT
