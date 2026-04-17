# HexBet — Motor de apuestas modular

Repositorio que implementa HexBet, un motor de apuestas modular. Proporciona una arquitectura basada en microservicios, contratos compartidos y un simulador para probar flujos de apuestas.

Estado: Phase 0 — bootstrap con `pnpm` workspaces y Turborepo.

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
- Simulador para reproducir escenarios (partidos, actualizaciones de cuotas, apuestas).

Tecnologías
- Node.js 18+
- pnpm (workspaces)
- Turborepo (orquestación de builds)
- TypeScript

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

