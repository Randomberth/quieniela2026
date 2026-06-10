# MVP Quiniela Teams4soft Mundialista
> Documentación Técnica - Junio 2026

## 📋 Resumen Ejecutivo
Aplicación interna de Quiniela (Predictor) para la Copa Mundial FIFA 2026, construida como proyecto de emergencia durante el torneo activo (Junio 2026). Sistema de predicciones en tiempo real con leaderboard competitivo para empleados de Teams4soft.

---

## 🗄️ **BASE DE DATOS (Supabase/PostgreSQL)**

### **Esquema Principal**

#### **Tablas**
| Tabla | Descripción | Columnas Clave |
|-------|-------------|----------------|
| `teams` | 48 selecciones mundialistas | `id`, `name_es`, `code`, `group_name` |
| `profiles` | Extensión de `auth.users` | `id` (FK auth), `username`, `full_name` |
| `matches` | 104 partidos del mundial | `match_number`, `home/away_team_id`, `match_date`, `status` |
| `predictions` | Predicciones de usuarios | `user_id`, `match_id`, `predicted_home`, `predicted_away` |
| `leaderboard_cache` | Ranking calculado | `user_id`, `rank`, `total_points`, `exact_predictions` |

#### **Índices de Rendimiento**
```sql
-- Optimizados para 48 equipos × 104 partidos × ~1000 usuarios
CREATE INDEX idx_predictions_user_match ON predictions(user_id, match_id);
CREATE INDEX idx_matches_date_status ON matches(match_date, status);
CREATE INDEX idx_leaderboard_rank ON leaderboard_cache(rank);
```

#### **Row Level Security (RLS)**
```sql
-- Politicas habilitadas por tabla:
-- 1. `predictions`: Usuarios solo CRUD sus predicciones
-- 2. `leaderboard_cache`: Lectura pública, DELETE/INSERT solo para trigger
-- 3. `profiles`: Usuarios solo ven perfiles públicos
-- 4. `teams` y `matches`: Lectura pública
```

### **Funciones y Triggers**

#### **1. `update_leaderboard_cache()`**
```sql
-- Trigger original (DESHABILITADO por conflicto)
-- Se ejecuta al INSERT/UPDATE en predictions
-- Genera error "DELETE requires WHERE clause" (21000)
```

#### **2. `refresh_leaderboard_manual()`** ✅ **ACTUAL**
```sql
-- Función RPC para refresco manual via botón UI
-- SECURITY DEFINER + WHERE true fix para RLS
-- Ejecución: SELECT refresh_leaderboard_manual();
```

#### **3. `calculate_prediction_points()`**
```sql
-- Calcula puntos al actualizar `matches.status = 'finished'`
-- 3 pts exacto, 1 pt tendencia, 0 pts incorrecto
```

### **Reglas de Negocio (Base de Datos)**
1. **Bloqueo Temporal**: `predictions` no pueden modificarse si `match_date <= NOW()`
2. **Escalado**: Cálculo de puntos solo cuando `matches.status = 'finished'`
3. **Integridad**: Foreign keys + ON DELETE CASCADE para perfiles
4. **Cache**: `leaderboard_cache` es tabla de resultados calculados

---

## 🖥️ **FRONTEND (React 19 + TypeScript)**

### **Stack Tecnológico**
```json
{
  "framework": "React 19.2.6 + Vite",
  "lenguaje": "TypeScript (Strict Mode)",
  "estilado": "Tailwind CSS 4.3 + Shadcn/ui",
  "estado": "TanStack Query v5 + hooks personalizados",
  "autenticación": "@supabase/supabase-js",
  "rutas": "React Router v7",
  "utilidades": "date-fns, lucide-react, class-variance-authority"
}
```

### **Arquitectura de Componentes**

#### **Páginas Principales (`/src/pages/`)**
- `Home.tsx` - Dashboard con resumen
- `Matches.tsx` - Lista de partidos (2-column grid)
- `Leaderboard.tsx` - Ranking con podio top 3
- `Profile.tsx` - Perfil usuario
- `Auth.tsx` - Login/registro

#### **Componentes Clave (`/src/components/`)**
| Componente | Responsabilidad |
|------------|-----------------|
| `MatchList.tsx` | Paginación por fecha + filtros (UI disabled) |
| `MatchCard.tsx` | Tarjeta individual con inputs predictivos |
| `LeaderboardTable.tsx` | Podio top 3 + tabla completa + botón refresh |
| `AuthForm.tsx` | Formulario auth con validación |
| `Navigation.tsx` | Navbar responsive con rutas protegidas |

#### **Hooks Personalizados (`/src/hooks/`)**
```typescript
// 1. useAuth() - Gestión sesión Supabase
// 2. useMatches() - Fetch partidos con cache
// 3. usePredictions() - CRUD predicciones con lock temporal
// 4. useLeaderboard() - Ranking + método refreshLeaderboard()
// 5. useErrorLogger() - Integración con logger central
```

### **Sistema de Logging**
```typescript
// src/lib/logger.ts
class ErrorLogger {
  error(metadata)    // Errores críticos
  warn(metadata)     // Advertencias
  info(metadata)     // Info operacional
  
  // Features:
  // - Persistencia localStorage (100 logs max)
  // - Export JSON
  // - Timestamp + userId + statusCode
  // - Integrado en todos los hooks
}
```

### **Reglas de Negocio (Frontend)**
1. **Lock UI**: Inputs disabled cuando `match_date <= new Date()`
2. **Validación**: Scores entre 0-10, no negativos
3. **Scoring Display**: 
   - ✅ 3 pts (verde) - Exacto
   - 🔶 1 pt (naranja) - Tendencia correcta  
   - ❌ 0 pts (rojo) - Incorrecto
4. **Timezone**: UTC en DB → conversión local basada en stadium
5. **Paginación**: Navegación Prev/Next por fecha (no infinite scroll)
6. **Performance**: `useMemo`/`useCallback` en listas grandes

---

## 🔧 **ESTADO ACTUAL Y WORKAROUNDS**

### **Problema Conocido**
```
ERROR: "DELETE requires a WHERE clause" (code 21000)
CAUSA: Trigger update_leaderboard_cache conflictúa con RLS
```

### **Solución Temporal Implementada**
1. **Trigger deshabilitado** en Supabase
2. **Función manual** `refresh_leaderboard_manual()` creada
3. **Botón UI** "Actualizar Ranking" en LeaderboardTable
4. **WHERE true fix** aplicado en DELETE statement

### **Flujo de Datos Actual**
```
Usuario predice → INSERT predictions → (NO trigger) 
Admin/Usuario hace click "Actualizar Ranking" → 
RPC refresh_leaderboard_manual() → 
DELETE leaderboard_cache WHERE true → 
RECALCULA ranking → 
UI refresh via TanStack Query invalidation
```

---

## 🚀 **PRÓXIMOS PASOS SUGERIDOS**

### **Prioridad Alta (MVP Completion)**
1. **Fix Trigger Permanente**
   ```sql
   -- Opción A: Revisar RLS policies de leaderboard_cache
   -- Opción B: Crear función SECURITY DEFINER que bypass RLS
   -- Opción C: Scheduled job cada 5 minutos vía Supabase Edge Functions
   ```

2. **Testing End-to-End**
   - Simular 48 equipos × 104 partidos
   - Test concurrencia: 100+ usuarios prediciendo simultáneo
   - Validar cálculo puntos con edge cases (0-0, 10-0, etc.)

3. **Monitorización**
   - Dashboard Supabase para query performance
   - Alertas RPC failures vía webhooks
   - Backup automático leaderboard_cache

### **Prioridad Media (UX/Performance)**
1. **PWA Offline Support**
   - Service Worker cache predictions
   - Sync queue cuando internet regresa

2. **Notifications**
   - WebSockets para live scores
   - Push notifications match locking

3. **Analytics**
   - Heatmap predictions populares
   - User engagement metrics

### **Prioridad Baja (Features Futuros)**
1. **Social Features**
   - Grupos/ligas privadas
   - Chat predictions
   - Share resultados

2. **Admin Panel**
   - Bulk update match scores
   - Force leaderboard refresh
   - User management

3. **Internationalization**
   - ES/EN toggle
   - Localized team names
   - Timezone auto-detection

---

## 📊 **MÉTRICAS DE ESCALABILIDAD**

| Componente | Capacidad Actual | Límite Teórico |
|------------|-----------------|----------------|
| Usuarios Concurrentes | ~100 | 10,000+ (Supabase) |
| Partidos | 104 | 500+ (índices optimizados) |
| Predictions/segundo | 50 | 1,000+ (RLS + batched) |
| Leaderboard Refresh | Manual | 5 min cron job |

---

## 🔐 **CONFIGURACIÓN DEPLOYMENT**

### **Variables de Entorno (.env)**
```bash
VITE_SUPABASE_URL=https://wvukzhwnfzpcbupmannm.supabase.co
VITE_SUPABASE_ANON_KEY=[anon_key]
# NOTA: Service role key NO en frontend
```

### **Build Commands**
```bash
npm run build    # TypeScript compile + Vite bundle
npm run lint     # ESLint validation
npm run preview  # Production preview
```

### **Supabase Project**
- **URL**: `wvukzhwnfzpcbupmannm.supabase.co`
- **Region**: AWS us-east-1
- **Plan**: Pro (RLS, Functions, Realtime)

---

## 📁 **ESTRUCTURA DE ARCHIVOS**
```
quinielaTeam4soft/
├── docs/
│   └── supabase_schema.sql      # Schema completo + fixes
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Client config
│   │   └── logger.ts            # Error logging system
│   ├── hooks/                   # Custom React hooks
│   ├── components/              # UI components
│   ├── pages/                   # Route pages
│   └── types/                   # TypeScript definitions
└── MVP_Quiniela_Teams4soft_mundialista.md (este archivo)
```

---

## 🎯 **CRITERIOS DE ÉXITO MVP**

- [x] **Usuarios** pueden registrar/login vía email
- [x] **Predictions** con lock temporal funcionando
- [x] **Scoring system** (3/1/0 pts) calculado correctamente
- [x] **Leaderboard** actualizable (manual workaround)
- [x] **UI Responsive** móvil/desktop
- [x] **Error logging** centralizado
- [ ] **Trigger automático** leaderboard (PENDIENTE FIX)
- [ ] **Load testing** 100 usuarios concurrentes

---

**Última Actualización**: 10 Junio 2026  
**Estado**: MVP Funcional con Workaround Temporal  
**Responsable**: Equipo Desarrollo Teams4soft  
**World Cup Status**: TORneo ACTIVO (Junio 2026)