# AXR

A modular plugin-based backend system built with TypeScript and Bun, featuring VQL integration.

## Features

- **Plugin Architecture** - Load and manage plugins dynamically from `./plugins` and `./plugins-custom` directories
- **VQL Integration** - Full support for VQL with adapter pattern
- **Event-Driven** - Built-in event emitter for inter-plugin communication
- **HTTP Server** - FalconFrame-based REST API with authentication
- **TypeScript** - Full type safety with TypeScript 6

## Prerequisites

- [Bun](https://bun.sh/) runtime
- Any linux distribution

## Installation

```bash
bun install
ing # from wxn0brP/dotfiles
```

## Configuration

Set the following environment variables before running:

- `AXR_AUTH` - **Required**. Authentication token for API access
- `AXR_SOCKET` - **Optional**. UNIX socket path (default: `/tmp/axr.sock`)

After first run, check `./config` directory for configuration files!

## Usage

### Start the Server

```bash
bun run start
```

### CLI access 

```bash
axr <vql query>
```

## API Endpoints

### Authentication

All endpoints require authentication via:
- `Authorization` header
- `auth` query parameter
- `authorization` in request body

### VQL Endpoints

- `GET /VQL?q=<query>` - Execute VQL query
- `GET /VQL/get-adapter` - Get adapter information
- `GET /VQL/get-adapters` - Get all available adapters

## Plugin System

### Creating a Plugin

Create a new directory in `./plugins` (git) or `./plugins-custom` (git ignore) with an `index.ts` file:

```typescript
import { PluginCtx } from "#core/types";

export default (ctx: PluginCtx) => {
    // Register adapter operations
    ctx.adapter.add("operationName", async (query) => {
        // Your logic here
        return { ok: true, data: result };
    });

    // Register findOne operations
    ctx.adapter.findOne("findOperation", async (query) => {
        // Your logic here
        return { ok: true, data: result };
    });
};
```

### Plugin Context

Plugins receive a context object with:

- `event` - Event emitter instance
- `app` - FalconFrame application instance
- `query` - VQL query execution function
- `vql` - VQL processor instance
- `adapter` - Adapter builder for registering operations


## License

MIT
