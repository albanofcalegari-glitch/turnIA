# TurnIA - Guia de instalacion y prueba

Sistema de turnos online multi-tenant. Esta guia te permite levantar el proyecto desde cero y probarlo como **administrador** y como **cliente**.

---

## Requisitos previos

Instalar antes de empezar:

| Software | Version minima | Descarga |
|----------|---------------|----------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| PostgreSQL | 14+ | https://www.postgresql.org/download/ |

Verificar que estan instalados:

```bash
node -v      # v20.x o superior
pnpm -v      # 9.x o superior
psql --version
```

---

## 1. Clonar el repositorio

```bash
git clone https://github.com/albanofcalegari-glitch/turnIA.git
cd turnIA
```

## 2. Instalar dependencias

```bash
pnpm install
```

## 3. Configurar variables de entorno

Copiar el archivo de ejemplo y ajustar si es necesario:

```bash
cp .env.example .env
```

El archivo `.env` tiene estos valores por defecto (funcionan para desarrollo local):

```env
DATABASE_URL="postgresql://postgres@localhost:5432/turnia"
JWT_SECRET="turnia-dev-secret-change-in-production"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
API_PORT=4000
WEB_URL="http://localhost:3000"
API_URL="http://localhost:4000"
```

> Si tu PostgreSQL usa password, ajusta el `DATABASE_URL`:
> `postgresql://postgres:TU_PASSWORD@localhost:5432/turnia`

## 4. Crear la base de datos

Abrir una terminal de PostgreSQL (o usar pgAdmin) y crear la DB:

```sql
CREATE DATABASE turnia;
```

## 5. Ejecutar migraciones

```bash
pnpm db:migrate
```

Esto crea todas las tablas necesarias en la base de datos.

## 6. Generar el cliente Prisma

```bash
pnpm db:generate
```

## 7. Levantar el proyecto

```bash
pnpm dev
```

Esto levanta dos servidores en paralelo:

- **API (NestJS):** http://localhost:4000
- **Web (Next.js):** http://localhost:3000

Esperar a que ambos terminen de compilar (puede tardar 20-30 segundos la primera vez).

---

## Probar como ADMINISTRADOR

### Registrar una cuenta

1. Ir a **http://localhost:3000/register**
2. Completar el formulario:
   - Nombre y apellido
   - Email y password
   - Nombre del negocio (ej: "Mi Barberia")
   - Slug (ej: "mi-barberia") - es la URL publica del negocio
   - Tipo de negocio

### Dashboard de administracion

Despues de registrarte, entras automaticamente al dashboard:

**http://localhost:3000/dashboard**

Desde ahi podes:

#### Servicios (`/dashboard/servicios`)
- Crear servicios que ofrece tu negocio (nombre, duracion, precio)
- Ejemplo: "Corte de pelo - 30 min - $5000"

#### Profesionales (`/dashboard/profesionales`)
- Agregar profesionales/empleados
- Vincularles los servicios que ofrecen
- Se pueden crear profesionales sin necesidad de que tengan cuenta en el sistema

#### Horarios (`/dashboard/horarios`)
- Seleccionar un profesional
- Activar los dias que trabaja (toggle on/off)
- Configurar hora de entrada y salida para cada dia
- Guardar los horarios

#### Agenda (`/dashboard/agenda` o `/dashboard`)
- Ver los turnos reservados en vista diaria o semanal
- Confirmar, completar, cancelar o marcar como no-show

#### Configuracion (`/dashboard/configuracion`)
- Ver la configuracion general del negocio

### Flujo recomendado para probar

1. Registrarte y crear un negocio
2. Ir a **Servicios** y crear al menos 1 servicio
3. Ir a **Profesionales** y crear al menos 1 profesional
4. Vincular el servicio al profesional (dropdown "Vincular servicio...")
5. Ir a **Horarios**, seleccionar el profesional, activar los dias y guardar
6. Listo! Ya podes probar como cliente

---

## Probar como CLIENTE

La pagina publica de reservas es:

**http://localhost:3000/{slug-del-negocio}**

Por ejemplo, si el slug es "mi-barberia":

**http://localhost:3000/mi-barberia**

### Flujo de reserva (5 pasos)

1. **Servicio** - Elegir que servicio queres
2. **Profesional** - Elegir con quien
3. **Fecha** - Seleccionar el dia
4. **Horario** - Ver los turnos disponibles y elegir uno
5. **Confirmacion** - Completar datos (nombre, email, telefono) y confirmar

> No se necesita cuenta para reservar como cliente (booking de invitado).

Despues de confirmar, el turno aparece en la Agenda del administrador.

---

## Estructura del proyecto

```
turnIA/
├── apps/
│   ├── api/          # Backend NestJS (puerto 4000)
│   └── web/          # Frontend Next.js (puerto 3000)
├── packages/
│   ├── database/     # Prisma schema + migraciones
│   └── shared/       # Tipos compartidos
├── .env.example      # Variables de entorno (copiar a .env)
├── package.json      # Scripts del monorepo
└── turbo.json        # Config de Turborepo
```

## Scripts utiles

| Comando | Que hace |
|---------|----------|
| `pnpm dev` | Levanta API + Web en modo desarrollo |
| `pnpm build` | Compila todo para produccion |
| `pnpm db:migrate` | Ejecuta migraciones pendientes |
| `pnpm db:generate` | Regenera el cliente Prisma |
| `pnpm db:studio` | Abre Prisma Studio (UI para ver la DB) |

## Troubleshooting

### "Error: listen EADDRINUSE"
Algun puerto (3000 o 4000) ya esta en uso. Cerrar el proceso que lo ocupa o cambiar el puerto en `.env`.

### "Error: P1001 - Can't reach database server"
PostgreSQL no esta corriendo o el `DATABASE_URL` es incorrecto. Verificar que el servicio de PostgreSQL este activo.

### Pagina en blanco en /dashboard
Borrar cookies y localStorage del navegador para localhost:3000. En la consola del navegador (F12):
```js
document.cookie = "turnia_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
localStorage.clear();
location.href = "/login";
```
