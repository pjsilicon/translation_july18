# NYC Dubbing QA Platform - Backend

Express TypeScript backend for the NYC dubbing quality assurance platform.

## Features

- **Express Server**: RESTful API with TypeScript
- **AI Integration**: OpenAI, Google Generative AI, and ElevenLabs APIs
- **Video Processing**: FFmpeg integration for video/audio manipulation
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: Bull queues with Redis for async processing
- **Authentication**: JWT-based authentication
- **File Upload**: Multer for handling file uploads
- **Logging**: Winston logger with file rotation
- **Security**: Helmet, CORS, rate limiting

## Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- FFmpeg

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file with:
- Database connection string
- Redis connection details
- API keys (OpenAI, Google AI, ElevenLabs)
- JWT secret
- Other configuration options

4. Run database migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

## Development

Run the development server:
```bash
npm run dev
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript files
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run prisma:studio` - Open Prisma Studio

## API Structure

- `/api/auth` - Authentication endpoints
- `/api/users` - User management
- `/api/projects` - Project management
- `/api/videos` - Video upload and processing
- `/api/dubbing` - Dubbing generation with AI
- `/api/qa` - Quality assurance reviews

## Architecture

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middlewares/    # Express middlewares
├── models/         # Data models
├── routes/         # API routes
├── services/       # Business logic services
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
├── jobs/           # Background job processors
└── server.ts       # Main server file
```

## Environment Variables

See `.env.example` for all available configuration options.

## Error Handling

The application uses centralized error handling with custom error classes and proper HTTP status codes.

## Security

- Helmet for security headers
- CORS configuration
- Rate limiting
- Input validation
- JWT authentication

## Logging

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

## Queue System

Background jobs are processed using Bull queues:
- Video processing
- Dubbing generation
- Report generation

## Database Schema

The database schema is defined in `prisma/schema.prisma` and includes:
- Users with roles
- Projects
- Videos
- Dubbing records
- QA reviews
- Notifications