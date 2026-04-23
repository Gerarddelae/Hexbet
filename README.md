# HexBet — Motor de apuestas modular

Repositorio que implementa HexBet, un motor de apuestas modular. Proporciona una arquitectura basada en microservicios, contratos compartidos y un simulador para probar flujos de apuestas.

Estado base: Phase 0/1 — bootstrap con `pnpm` workspaces + Turborepo e infraestructura local con Docker Compose.

Estado actual: avance hasta Phase 7 con Bet Service completo (place bet + endpoints internos para Settlement)

Resumen
- Propósito: implementación y demostración técnica de un motor de apuestas modular.
- Alcance: prototipo técnico; no está preparado para despliegue en producción.

Contenido
- `apps/` — Servicios del dominio (por ejemplo: `api-gateway`, `bet-service`, `odds-engine`, `settlement`).
- `packages/` — Código compartido y contratos (por ejemplo: `shared-kernel`).
- `simulator/` — CLI para generar eventos y probar flujos end-to-end.

Características principales
- Arquitectura modular basada en microservicios.
- Contratos y tipos centralizados en `packages/shared-kernel`.
- Simulador para reproducir escenarios de partido y validar procesamiento de eventos en Kafka.
- Soporte de ejecución repetida del simulador con `--fresh-match-ids`.
- API Gateway con autenticación JWT, rate limiting y proxying HTTP.
- WebSocket para streaming de cuotas en tiempo real.

Tecnologías
- Node.js 18+
- pnpm (workspaces)
- Turborepo (orquestación de builds)
- TypeScript
- Express + NestJS (API Gateway)
- Socket.io (WebSocket)
- Redis (rate limiting)

Instalación y ejecución local
Clonar el repositorio y entrar al directorio del proyecto:

```bash
git clone <tu-repo-url>
cd HexBet
```

Instalar dependencias:

```bash
pnpm install
```

Comandos útiles
- Instalar dependencias: `pnpm install`
- Chequeo de tipos: `pnpm typecheck`
- Construir todo: `pnpm build`
- Iniciar servicios para desarrollo (ejemplo):

```bash
pnpm --filter ./apps/* dev
```

- Levantar infraestructura local: `pnpm docker:up`
- Ver estado de contenedores: `pnpm docker:ps`
- Ver topics de Kafka: `pnpm docker:topics`
- Apagar infraestructura: `pnpm docker:down`
- Limpiar contenedores legacy: `pnpm docker:cleanup:legacy`
- Listar escenarios del simulador: `pnpm --filter @betting-engine/simulator list-scenarios`
- Ejecutar simulador (modo normal): `pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x`
- Ejecutar simulador (modo fresh): `pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x --fresh-match-ids`
- Levantar API Gateway: `pnpm --filter @betting-engine/api-gateway dev`
- Verificar health del Gateway: `curl http://localhost:3000/health`
- Proxificar a bet-service: `curl http://localhost:3000/bet-service/matches/live`

Uso rápido del simulador
- Modo normal (por defecto): usa el `matchId` definido en el JSON del escenario.
- Modo fresh (`--fresh-match-ids`): regenera `matchId` en memoria por corrida para crear partidos nuevos sin modificar archivos `.json`.

Infraestructura incluida en Phase 1
- Zookeeper
- Kafka (single-broker) + inicialización automática de topics
- PostgreSQL + schemas base (`odds_engine`, `bet_service`, `settlement`)
- Redis

Para usar valores personalizados, copia `.env.example` a `.env` y ajusta puertos/credenciales locales.

Documentacion adicional:
- `docs/PHASE0_SUMMARY.md`
- `docs/PHASE1_SUMMARY.md`
- `docs/PHASE2_SUMMARY.md`
- `docs/PHASE3_SUMMARY.md`
- `docs/PHASE4_SUMMARY.md`
- `docs/PHASE5_SUMMARY.md`
- `docs/PHASE6_SUMMARY.md`
- `docs/PHASE7_SUMMARY.md`
- `docs/DEVELOPMENT.md`

Estructura resumida
- `apps/api-gateway` — Orquestación y enrutado de peticiones.
- `apps/bet-service` — Registro y gestión de apuestas.
- `apps/odds-engine` — Cálculo y actualización de cuotas.
- `apps/settlement` — Lógica de liquidación.
- `packages/shared-kernel` — Eventos, tipos e interfaces compartidas.

Demostración / Ejemplo de uso
- El `simulator` permite generar flujos (creación de evento, apuestas, cambios de cuota, liquidación) para pruebas locales.
- Se recomienda capturar un ejemplo visual (GIF o video corto) que muestre el flujo completo.

Licencia
- Especificar la licencia del proyecto (por ejemplo, MIT) según corresponda.

Soporte
- Para reportar problemas o sugerencias, abrir un issue en el repositorio.

Archivos relevantes
- [packages/shared-kernel](packages/shared-kernel/README.md) — contratos y tipos compartidos.

