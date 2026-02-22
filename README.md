# Anima MMO

Setup inicial fullstack com:
- Frontend: React + Vite + Tailwind + ShadCN UI
- Backend: Node.js + Express + Prisma + MySQL
- Auth: login/registro com JWT em cookie HttpOnly

## Estrutura
- `frontend/`: UI autenticada, login, registro, homepage, sidebar treeview
- `backend/`: API auth (`/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`)

## Rodando localmente
1. Backend:
   - `cd backend`
   - `npm install`
   - Ajuste `backend/.env` se necessario
   - `npm run prisma:generate`
   - `npm run dev`
2. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Testes
- Backend: `cd backend && npm test`
- Frontend unit: `cd frontend && npm test`
- Frontend e2e: `cd frontend && npm run test:e2e`

## Observacao de migracao
A criacao da migracao Prisma (`prisma migrate dev --name init --create-only`) depende do MySQL local ativo em `localhost:3306`.
