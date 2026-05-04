# 🎬 Streamix — IPTV Streaming Platform

> Plataforma de streaming estilo Netflix para IPTV. Reproduce listas M3U/M3U8 gratuitas con interfaz moderna, soporte 4K, EPG en vivo, subtítulos en español y deploy 100% gratuito en la nube.

---

## ✨ Características

| Feature | Detalle |
|---------|---------|
| 🎬 **4K UHD** | Detección automática de streams en 4K, 1080p, 720p |
| 📺 **Live TV** | Miles de canales con guía EPG en tiempo real |
| 🎭 **VOD** | Películas y series con pósters y sinopsis (TMDB) |
| 🌎 **Multi-idioma** | Audio original, español y subtítulos ES |
| 🔍 **Búsqueda** | Busca entre todos los canales, películas y series |
| 📱 **PWA** | Instálala en Smart TV, móvil o escritorio |
| ♾️ **24/7** | Backend auto-refrescante cada 6 horas |
| 💰 **$0/mes** | 100% gratuito en Railway + Vercel + Cloudflare |

---

## 🏗 Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Fuentes Gratuitas (iptv-org/iptv — MIT License)            │
│  index.m3u · movies.m3u · series.m3u · countries/mx.m3u    │
│  EPG: iptv-org/epg (XMLTV gzipped)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ parse cada 6h
┌──────────────────────────▼──────────────────────────────────┐
│  Backend — Node.js + Express (Railway FREE)                 │
│  ├── M3U Parser  — HLS/MPEG-TS, calidad, idioma            │
│  ├── EPG Parser  — XMLTV → JSON, current/next program      │
│  ├── TMDB Service — pósters, sinopsis, ratings              │
│  ├── REST API    — /home /live /movies /series /search      │
│  └── Caché L1/L2/L3 — node-cache multicapa                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / Cloudflare CDN
┌──────────────────────────▼──────────────────────────────────┐
│  Frontend — React + Vite + hls.js (Vercel FREE)            │
│  ├── Hero Banner        — contenido destacado               │
│  ├── Carruseles         — filas horizontales tipo Netflix   │
│  ├── VideoPlayer        — HLS.js 4K, multi-audio, subs     │
│  ├── Live TV Grid       — EPG en vivo, filtros             │
│  └── PWA               — instálala en Smart TV             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Inicio Rápido (Local)

### Pre-requisitos
- Node.js 18+
- Git

### 1. Clona el repositorio
```bash
git clone https://github.com/TU_USUARIO/streamix.git
cd streamix
```

### 2. Configura el backend
```bash
cd backend
npm install
cp .env.example .env
# Edita .env con tu TMDB_API_KEY (gratuita en themoviedb.org)
npm run dev
# API disponible en http://localhost:3001
```

### 3. Inicia el frontend
```bash
# En otra terminal
cd frontend
npm install
npm run dev
# App disponible en http://localhost:5173
```

### Con Docker (todo en uno)
```bash
cd streamix
TMDB_API_KEY=tu_key docker-compose up --build
# App: http://localhost | API: http://localhost:3001
```

---

## ☁️ Deploy Gratuito en la Nube

### Costo total: **$0/mes**

| Servicio | Uso | Costo |
|----------|-----|-------|
| [Railway](https://railway.app) | Backend API | $0 (500h/mes) |
| [Vercel](https://vercel.com) | Frontend | $0 (ilimitado) |
| [Cloudflare](https://cloudflare.com) | CDN + SSL | $0 |
| [TMDB API](https://themoviedb.org) | Metadata | $0 |
| [iptv-org/iptv](https://github.com/iptv-org/iptv) | Listas M3U | $0 (MIT) |

Ver guía completa en [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 📁 Estructura del Proyecto

```
streamix/
├── backend/
│   ├── parsers/
│   │   ├── m3uParser.js      # Parser M3U + detección 4K/idioma
│   │   └── epgParser.js      # Parser XMLTV para guía de programas
│   ├── services/
│   │   └── tmdbService.js    # Enriquecimiento con TMDB API
│   ├── scripts/
│   │   └── test-sources.js   # Verifica conectividad de fuentes
│   ├── server.js             # Express API + scheduler + caché
│   ├── Dockerfile            # Docker optimizado para Railway
│   └── .env.example          # Variables de entorno necesarias
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoPlayer.jsx   # Reproductor HLS.js 4K
│   │   │   ├── ContentRow.jsx    # Carrusel horizontal tipo Netflix
│   │   │   ├── HeroBanner.jsx    # Banner hero con backdrop
│   │   │   └── Navbar.jsx        # Navegación con búsqueda live
│   │   ├── pages/
│   │   │   ├── HomePage.jsx      # Inicio con carruseles
│   │   │   ├── LivePage.jsx      # TV en vivo con EPG
│   │   │   └── MoviesPage.jsx    # Películas y Series con filtros
│   │   └── services/
│   │       └── api.js            # Cliente API con caché local
│   ├── public/
│   │   ├── sw.js             # Service Worker (PWA)
│   │   ├── manifest.json     # PWA manifest
│   │   └── favicon.svg       # Ícono Streamix
│   └── Dockerfile.prod       # Build + nginx para producción
│
├── docker-compose.yml        # Dev/prod local completo
├── DEPLOYMENT.md             # Guía paso a paso de deploy
└── .github/workflows/        # CI/CD con GitHub Actions
```

---

## 📡 API Endpoints

| Endpoint | Descripción |
|----------|-------------|
| `GET /health` | Estado del servidor y conteos |
| `GET /api/home` | Hero + carruseles para la pantalla de inicio |
| `GET /api/live` | Canales en vivo (paginado, filtros) |
| `GET /api/live/categories` | Categorías disponibles de live TV |
| `GET /api/movies` | Películas VOD (paginado, filtros) |
| `GET /api/series` | Series VOD (paginado, filtros) |
| `GET /api/content/:id` | Item individual con EPG actual |
| `GET /api/epg/:channelId` | Guía de programas de un canal |
| `GET /api/search?q=` | Búsqueda global |
| `GET /api/stream/:id` | Redirect 302 al stream real |
| `POST /api/admin/refresh` | Fuerza recarga de fuentes M3U |

### Parámetros de filtro (live, movies, series)
```
?page=1&limit=50          # Paginación
?search=cnn              # Búsqueda por nombre
?category=Deportes       # Filtro por categoría
?quality=4K              # Filtro por calidad (4K, 1080p, 720p, HD, SD)
?lang=es                 # Filtro por idioma (es, en, pt...)
?country=MX              # Filtro por país
?4k=true                 # Solo streams 4K
```

---

## 📺 Fuentes de Contenido (iptv-org/iptv)

Todas las fuentes son del repositorio [iptv-org/iptv](https://github.com/iptv-org/iptv) bajo licencia **MIT**:

- **+8,000 canales en vivo** de todo el mundo
- **Películas y Series** categorizadas
- **México, España, USA** — canales regionales
- **Deportes, Noticias, Entretenimiento** — por categoría
- **EPG** de [iptv-org/epg](https://github.com/iptv-org/epg) (XMLTV)

Para agregar más listas, edita `FREE_SOURCES` en `backend/parsers/m3uParser.js`.

---

## 🎮 Controles del Reproductor

| Tecla | Acción |
|-------|--------|
| `Space` | Play / Pause |
| `→` / `←` | Adelantar / Retroceder 10s |
| `↑` / `↓` | Volumen +/- |
| `F` | Pantalla completa |
| `M` | Silenciar |
| `Esc` | Cerrar reproductor |

---

## 🔧 Variables de Entorno (Backend)

```env
PORT=3001                          # Puerto del servidor
TMDB_API_KEY=tu_api_key            # Gratis en themoviedb.org/settings/api
ADMIN_TOKEN=token_secreto          # Para el endpoint /api/admin/refresh
FRONTEND_URL=https://tu-app.vercel.app  # Para CORS
NODE_ENV=production
```

---

## 📱 Smart TV / Chromecast

La app es una **PWA** instalable:

- **Android TV**: Chrome → tu URL → "Agregar a pantalla de inicio"
- **Fire TV**: Silk Browser → tu URL → instalar
- **Chromecast**: Transmite pestaña desde Chrome en PC/Android
- **iPhone/iPad**: Safari → "Agregar a pantalla de inicio"

---

> Generado con ❤️ por Claude (Anthropic)
> Stack: Node.js · Express · React · Vite · hls.js · Docker
> Fuentes: [iptv-org/iptv](https://github.com/iptv-org/iptv) (MIT) · [TMDB](https://themoviedb.org) · [iptv-org/epg](https://github.com/iptv-org/epg)
