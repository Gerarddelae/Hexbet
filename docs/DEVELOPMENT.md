# Desarrollo Local - HexBet

## Requisitos

- Node.js 18+
- pnpm 10+
- Docker Desktop

## Primera Ejecucion

1. Instalar dependencias:

   pnpm install

2. Limpiar contenedores legacy (si vienes de una version anterior):

   pnpm docker:cleanup:legacy

3. Levantar infraestructura:

   pnpm docker:up

4. Verificar estado:

   pnpm docker:ps

5. Verificar topics:

   pnpm docker:topics

## Comandos Utiles

- Levantar infraestructura: pnpm docker:up
- Apagar infraestructura: pnpm docker:down
- Reset completo (incluye volumenes): pnpm docker:reset
- Logs: pnpm docker:logs
- Estado de contenedores: pnpm docker:ps
- Topics Kafka: pnpm docker:topics

## Calidad

- Typecheck global: pnpm typecheck
- Build global: pnpm build
- Test global: pnpm test
- Validacion CI local: pnpm ci:check

## Apps (Bootstrap)

- api-gateway: puerto 3000
- odds-engine: puerto 3001
- bet-service: puerto 3002
- settlement: puerto 3003

Todos exponen:

- GET /health

## Variables de Entorno

Usar .env.example como base y copiar a .env si necesitas personalizar puertos/credenciales.

## Problemas Frecuentes

1. Kafka no aparece corriendo inmediatamente:
   - Espera unos segundos y corre pnpm docker:ps de nuevo.
   - Si sigue fallando, ejecuta pnpm docker:reset y luego pnpm docker:up.

2. Conflicto con contenedores antiguos:
   - Ejecuta pnpm docker:cleanup:legacy.

3. Topics no listan:
   - Verifica que kafka este healthy en pnpm docker:ps.
   - Reintenta pnpm docker:topics.
