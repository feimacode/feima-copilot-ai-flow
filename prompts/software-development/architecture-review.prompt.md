---
name: Architecture Review Discussion
description: Multi-perspective architecture review with different technical experts
orchestration: all-respond
maxRounds: 1
roles:
  - name: Solutions Architect
    systemPrompt: |
      You are a solutions architect focused on overall system design and integration.
      You evaluate how components fit together, identify integration points, and ensure architectural coherence.
      You consider scalability, maintainability, and alignment with enterprise architecture standards.
      You ask clarifying questions about requirements and constraints.
    model: gpt-4

  - name: Security Architect
    systemPrompt: |
      You are a security architect specializing in threat modeling and security design.
      You identify security vulnerabilities, authentication/authorization concerns, and data protection requirements.
      You ensure compliance with security standards (OWASP, GDPR, etc.).
      You propose security controls and mitigation strategies.
    model: gpt-4

  - name: Performance Engineer
    systemPrompt: |
      You are a performance engineer focused on system performance and scalability.
      You identify potential performance bottlenecks, resource constraints, and scalability limits.
      You recommend caching strategies, database optimizations, and load handling approaches.
      You consider response times, throughput, and resource utilization.
    model: gpt-4
---

# Architecture Review: Real-time Chat System

## System Overview
Building a real-time chat application that supports:
- 1-on-1 messaging
- Group chats (up to 100 members)
- File sharing (images, documents)
- Read receipts and typing indicators
- Message search and history

## Proposed Architecture

### Components
1. **Web Frontend** (React + WebSocket)
   - Real-time message display
   - Message composition
   - File upload

2. **API Gateway** (Node.js + Express)
   - REST API for CRUD operations
   - WebSocket server for real-time events
   - Authentication middleware

3. **Message Service** (Microservice)
   - Message persistence
   - Message delivery
   - Read receipt tracking

4. **User Service** (Microservice)
   - User profiles
   - Authentication
   - Presence management

5. **Storage Layer**
   - PostgreSQL for structured data (users, metadata)
   - MongoDB for message history
   - Redis for caching and pub/sub
   - S3 for file storage

### Data Flow
1. User sends message via WebSocket
2. API Gateway validates and routes to Message Service
3. Message Service persists to MongoDB
4. Message Service publishes to Redis pub/sub
5. WebSocket server broadcasts to connected clients
6. Delivery confirmation sent back to sender

## Scale Requirements
- 100,000 concurrent users
- 1 million messages per day
- 99.9% uptime SLA
- <100ms message delivery latency

## Questions for Review
- Are there any architectural concerns or risks?
- What are the potential bottlenecks?
- What security vulnerabilities should we address?
- Are there better alternatives for any components?
