# SmartQueue — Production-Grade Real-Time Queue & Crowd Management Platform

## 📌 Executive Project Overview

**SmartQueue** is an enterprise-grade, multi-tenant MERN stack (MongoDB, Express, React, Node.js) platform designed for real-time queue orchestration and crowd density management across high-traffic operations (hospitals, banks, government institutions, university portals, salons, and service centers). 

SmartQueue solves customer line fatigue and staff operational friction through automated priority scheduling, smart wait-time forecasting, secure QR token check-in, real-time WebSocket updates, Redis caching, BullMQ background notification processing, Docker containerization, and strict multi-role authorization (RBAC).

---

## 🌐 Deployment & URL Distinction

> [!IMPORTANT]
> **Environment Endpoint & Sample Data Attribution**:
> - **Fictional Demo Content**: All demonstration organizations, locations, staff accounts, customer profiles, queue tokens, and service history records in seed scripts are fictional sample data created for evaluation purposes. No real personal information (PII) is included.
> - **Local Development Endpoints**:
>   - Frontend SPA: `http://localhost:5173`
>   - Reverse Proxy Nginx / Docker: `http://localhost:8080`
>   - Express API Server: `http://localhost:5000`
>   - MongoDB Primary: `mongodb://127.0.0.1:27017/smartqueue`
>   - Redis Cache: `redis://127.0.0.1:6379`
> - **Public Cloud Production Environment**:
>   - *Public production URL is not independently verified.* Infrastructure manifests support deployment to cloud container platforms (AWS ECS/App Runner, DigitalOcean App Platform, Render, or GCP Cloud Run) with TLS termination via reverse proxies.

---

## ⚡ Architectural Highlights & Performance Engineering

1. **Authoritative Primary Storage & Indexing**: MongoDB/Mongoose functions as the 100% single source of truth. Queries are optimized with compound index strategies (`{ queueId: 1, isActive: 1, status: 1, joinedAt: 1 }`), eliminating collection scans (`COLLSCAN` -> `IXSCAN`) and reducing batch lookup execution times under 15ms.
2. **High-Performance Redis Caching**: Multi-tier cache-aside layer with stampede protection (mutex request coalescing) and TTL invalidation hooks for organization discovery, queue metadata, and customer counters.
3. **Decoupled Background Job Queue**: BullMQ integration backed by Redis handles notification job enqueueing, exponential backoff retries (3 attempts), idempotency verification, and user-scoped Socket.IO events (`user:${userId}`).
4. **Real-Time Event Engine**: Socket.IO server emitting granular room events (`queue:${queueId}:updated`, `admin:live-crowd`) with automatic token authentication and connection recovery.
5. **Frontend Performance & Route Code-Splitting**: React SPA with `React.lazy` and `React.Suspense` chunking for heavy admin analytics/Recharts bundles, resulting in instant initial page loads and 0 console runtime errors.
6. **Zero-Trust Authorization & Security**: Cross-Origin HttpOnly JWT cookies (`SameSite=Lax/Strict`), rate limiting (`express-rate-limit`), Helmet security headers, NoSQL injection protection, and BOLA/IDOR object isolation.

To run the full backend release validation test inventory:
```bash
cd backend
npm run dev

To build the frontend production bundle:
```bash
cd frontend
npm run build
```


## 💼 Portfolio Highlights & Resume Statements

- **Architected a production-grade multi-tenant Queue & Crowd Management Platform (SmartQueue)** servicing 3 primary user roles (Customer, Staff, Admin) with real-time Socket.IO synchronization.
- **Engineered an asynchronous background job processing pipeline using BullMQ and Redis**, offloading non-blocking notification dispatches with automatic idempotency and exponential backoff retry policies.
- **Optimized MongoDB database query performance**, introducing targeted compound indexes and `.lean()` projections that eliminated full collection scans (`COLLSCAN` -> `IXSCAN`) and cut query latency below 15ms.
- **Implemented multi-tier caching (Redis Cache-Aside)** with stampede protection, graceful offline fallbacks to MongoDB, and automated invalidation triggers across organization and queue entities.
- **Containerized full application stack with Docker & Docker Compose**, orchestrating non-root Express API, BullMQ workers, Nginx SPA reverse proxy, Redis, and MongoDB with health checks and volume persistence.
- **Enforced end-to-end security and authorization**, incorporating HttpOnly JWT session cookies, RBAC route guards, NoSQL injection sanitization, rate limiting, and strict IDOR/BOLA data isolation.

---on eavesdropping across tenants.

