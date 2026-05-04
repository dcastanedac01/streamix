# 🎬 STREAMIX — Guía de Deployment Completa

## Lo que YO (Claude) hice (código ya listo):
- ✅ Parser M3U completo con detección de calidad 4K/HD y idioma
- ✅ Parser EPG/XMLTV para guía de programas
- ✅ API REST con paginación, filtros y caché multicapa
- ✅ Scheduler que refresca contenido cada 6 horas
- ✅ Enriquecimiento de metadata vía TMDB (pósters, sinopsis, ratings)
- ✅ Frontend React estilo Netflix con HeroBanner + carruseles
- ✅ Reproductor HLS.js con soporte 4K, multi-audio, subtítulos
- ✅ Página de Live TV con EPG y filtros por categoría
- ✅ Página de Películas con filtros de calidad/idioma/ordenamiento
- ✅ Dockerfiles + docker-compose para local
- ✅ Configs de Railway (backend) y Vercel (frontend) ya escritas

---

## Lo que TÚ debes hacer (30-45 minutos):

### PASO 1 — Consigue tu API key de TMDB (5 min)
1. Ve a https://www.themoviedb.org/signup y crea cuenta gratuita
2. Ve a https://www.themoviedb.org/settings/api
3. Solicita una API key para "uso personal" — se aprueba al instante
4. Copia la "API Key (v3 auth)" — la necesitarás más adelante

### PASO 2 — Sube el código a GitHub (5 min)
```bash
# En tu terminal, dentro de la carpeta streamix/
git init
git add .
git commit -m "Initial Streamix commit"
git branch -M main

# Crea un repo en github.com/new (puede ser privado)
git remote add origin https://github.com/TU_USUARIO/streamix.git
git push -u origin main
```

### PASO 3 — Deploy del Backend en Railway (10 min)
Railway tiene tier gratuito: 500 horas/mes, $5 de crédito/mes.

1. Ve a https://railway.app y regístrate con tu cuenta de GitHub
2. Click en "New Project" → "Deploy from GitHub repo"
3. Selecciona tu repositorio `streamix`
4. Railway detectará el Dockerfile automáticamente
5. **IMPORTANTE**: Configura el Root Directory como `backend`
   - En Railway → tu servicio → Settings → Root Directory → escribe `backend`
6. Ve a "Variables" y agrega estas variables de entorno:
   ```
   TMDB_API_KEY    = [tu key del paso 1]
   ADMIN_TOKEN     = [genera uno: openssl rand -hex 32]
   FRONTEND_URL    = https://streamix.vercel.app  (lo cambias después)
   NODE_ENV        = production
   PORT            = 3001
   ```
7. El deploy inicia automáticamente. Espera ~3 min.
8. Copia la URL pública que Railway asigna:
   Ejemplo: `https://streamix-backend-production.up.railway.app`

**Verifica que funciona:**
```bash
curl https://TU-URL-RAILWAY.up.railway.app/health
# Debe responder: {"status":"loading",...} → luego {"status":"ready",...}
```

### PASO 4 — Deploy del Frontend en Vercel (10 min)
Vercel es 100% gratuito para proyectos personales.

1. Ve a https://vercel.com y regístrate con GitHub
2. Click en "New Project" → importa tu repo `streamix`
3. **IMPORTANTE**: Configura:
   - Framework Preset: **Vite**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. En "Environment Variables" agrega:
   ```
   VITE_API_URL = https://TU-URL-RAILWAY.up.railway.app
   ```
5. Click "Deploy" — tarda ~2 minutos
6. Vercel te dará una URL como: `https://streamix-xxx.vercel.app`

### PASO 5 — Actualiza CORS en Railway (2 min)
Ahora que tienes la URL de Vercel, actualiza la variable en Railway:
```
FRONTEND_URL = https://streamix-xxx.vercel.app
```
Railway hace redeploy automáticamente.

### PASO 6 — Configura Cloudflare (opcional pero muy recomendado)
Cloudflare es GRATIS y mejora enormemente el rendimiento:

1. Ve a https://cloudflare.com → crea cuenta gratuita
2. Si tienes dominio propio: apúntalo a Cloudflare
3. Si no tienes dominio: el CDN de Vercel ya incluye edge caching básico

Con Cloudflare puedes:
- Cachear imágenes de TMDB en edge global (TTL 24h)
- Protección DDoS gratis
- SSL automático
- Analytics de visitas

---

## ✅ VERIFICACIÓN FINAL

Una vez deployed, verifica estos endpoints:

```bash
# Backend health (debe mostrar ready y conteos de canales)
curl https://TU-RAILWAY.up.railway.app/health

# Home API (debe retornar featured + rows con carruseles)
curl https://TU-RAILWAY.up.railway.app/api/home

# Live TV (debe retornar canales de IPTV)
curl https://TU-RAILWAY.up.railway.app/api/live?limit=5

# Películas
curl https://TU-RAILWAY.up.railway.app/api/movies?limit=5

# Búsqueda
curl "https://TU-RAILWAY.up.railway.app/api/search?q=news"
```

---

## 🎯 FUENTES DE CONTENIDO (100% gratuitas)

### Listas M3U — iptv-org/iptv (MIT License)
Estas fuentes están configuradas en `backend/parsers/m3uParser.js`:

| URL | Contenido |
|-----|-----------|
| `https://iptv-org.github.io/iptv/index.m3u` | +8,000 canales globales |
| `https://iptv-org.github.io/iptv/countries/mx.m3u` | Canales México |
| `https://iptv-org.github.io/iptv/countries/es.m3u` | Canales España |
| `https://iptv-org.github.io/iptv/categories/movies.m3u` | Películas |
| `https://iptv-org.github.io/iptv/categories/series.m3u` | Series |
| `https://iptv-org.github.io/iptv/categories/sports.m3u` | Deportes |
| `https://iptv-org.github.io/iptv/categories/news.m3u` | Noticias |

**Para agregar más listas M3U:**
Edita el array `FREE_SOURCES` en `backend/parsers/m3uParser.js`:
```javascript
live: [
  // Agrega aquí cualquier URL M3U pública
  { url: 'https://mi-lista.m3u', label: 'Mi Lista Extra' },
  ...
]
```

### EPG (Guía de Programas) — iptv-org/epg (gratis)
Configuradas en el mismo archivo, array `FREE_EPG_SOURCES`.

---

## 💡 COSTOS REALES

| Servicio | Plan | Costo |
|----------|------|-------|
| Railway | Starter (500h/mes) | **$0/mes** |
| Vercel | Hobby | **$0/mes** |
| Cloudflare | Free | **$0/mes** |
| TMDB API | Gratuito | **$0** |
| iptv-org listas | MIT License | **$0** |
| GitHub repo | Free | **$0** |
| **TOTAL** | | **$0/mes** |

Railway da $5 crédito mensual gratis. El backend consume ~$2-3/mes con tráfico normal.

---

## 🔧 COMANDOS ÚTILES

### Desarrollo local
```bash
# Backend
cd streamix/backend
npm install
cp .env.example .env   # edita con tu TMDB_API_KEY
npm run dev

# Frontend (otra terminal)
cd streamix/frontend
npm install
npm run dev
# Abre http://localhost:5173
```

### Docker Compose (todo junto)
```bash
cd streamix
docker-compose up --build
# Backend: http://localhost:3001
# Frontend: http://localhost:80
```

### Forzar refresh de contenido (en producción)
```bash
curl -X POST https://TU-RAILWAY.up.railway.app/api/admin/refresh \
  -H "x-admin-token: TU_ADMIN_TOKEN"
```

---

## 📺 SOPORTE SMART TV

La app es una **Progressive Web App (PWA)**. Para instalarla en Smart TVs:
- **Android TV / Google TV**: Abre Chrome en la TV → navega a tu URL de Vercel → "Instalar app"
- **Apple TV**: No soporta PWA directamente, pero funciona en Safari
- **Chromecast**: Transmite la pestaña de Chrome directamente desde PC/Android
- **Fire TV**: Instala el APK de Silk Browser → navega a tu URL

Para una experiencia óptima en TV, usa las teclas del control:
- **Space / OK**: Play/Pause
- **Flechas izq/der**: Retroceder/Avanzar 10 segundos
- **Flechas arriba/abajo**: Volumen
- **F**: Pantalla completa
- **Escape / Back**: Cerrar reproductor

---

## 🚀 MEJORAS FUTURAS (para ti)

Una vez que todo funcione, considera agregar:
1. **Supabase** (free) para guardar favoritos y historial de usuarios
2. **Upstash Redis** (free, 10K req/día) para caché distribuido si creces
3. **Dominio propio** ($10/año en Namecheap) + Cloudflare gratuito
4. **GitHub Actions** para CI/CD automático al hacer push

---

> Proyecto generado por Claude — Anthropic
> Stack: Node.js + Express + React + hls.js + Docker
> Fuentes: iptv-org/iptv (MIT) + TMDB API (free)
