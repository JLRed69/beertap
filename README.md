# BeerTap Live

Demo en vivo de **BeerTap** — sirve cerveza por auto-servicio con app de cliente, estación tipo tap y panel de admin, sincronizados en tiempo real por MQTT (broker público, sin servidor propio).

## Despliegue en GitHub Pages

1. Crea un repositorio público en GitHub (ej: `beertap-live`).
2. Sube **`index.html`** y este `README.md` a la raíz del repo (la rama `main`).
3. En GitHub: **Settings → Pages**.
4. En **Source** elige `Deploy from a branch`.
5. En **Branch** elige `main` y carpeta `/ (root)`. Guarda.
6. En 30–60 s tu sitio estará en:

   ```
   https://<tu-usuario>.github.io/<tu-repo>/
   ```

Esa URL es HTTPS — la cámara del Android funcionará sin problemas.

## Cómo usar

Abre la URL en cualquier dispositivo. En el lanzador:

1. **Define un código de cuarto** (ej. `mi-bar-001`). Es el "canal" que comparten los dispositivos. Cualquier código alfanumérico funciona; cámbialo cuando quieras un demo aislado.
2. Abre **tres veces** la URL — una en cada dispositivo — añadiendo el modo y el cuarto a la URL:

   | Dispositivo | Modo | URL |
   |---|---|---|
   | Computadora | Administrador | `…/?mode=admin&room=mi-bar-001` |
   | iPhone (cliente) | Cliente | `…/?mode=customer&room=mi-bar-001` |
   | Soyes Mini (estación) | Estación | `…/?mode=station&room=mi-bar-001` |

   O escanea los QR que aparecen en el lanzador.

3. En el iPhone crea tu cuenta (te regala $200 de bienvenida).
4. En el mini Android, concede permiso de cámara.
5. Toca el anuncio en la estación → muestra tu QR del iPhone → elige tamaño → el saldo se descuenta en los tres dispositivos en vivo.

## Cómo funciona la sincronización

- Cada cliente publica el estado completo (usuarios + transacciones + recargas) en el topic MQTT `beertap/<cuarto>/state` con `retain: true`.
- Cualquier dispositivo nuevo recibe el último snapshot inmediatamente.
- Conflictos se resuelven por **versión monotónica + timestamp** (last-writer-wins).
- Broker primario: `wss://broker.emqx.io:8084/mqtt` · fallback: `wss://broker.hivemq.com:8884/mqtt` (ambos públicos y anónimos).
- Si pierdes internet, el estado sigue persistido en `localStorage` por dispositivo.

## Privacidad

El broker es **público**: cualquiera que conozca tu código de cuarto puede leer y escribir en él. Para demos está bien; **no lo uses con datos reales**. Para producción levanta tu propio broker MQTT (Mosquitto, EMQX, HiveMQ Cloud free tier).

## Archivo único

`index.html` es **autocontenido** — embebe React, MQTT.js, jsQR, qrcode-generator, todo el CSS y todo el código. No necesita CDN ni build. Pesa ~1.8 MB.

## Stack

- React 18 (UMD) + Babel standalone para JSX en vivo
- MQTT.js para sincronización
- jsQR para escaneo de QR por cámara
- qrcode-generator para generar QR
- SVG puro para el vaso 3D
- Bricolage Grotesque + Geist + JetBrains Mono (Google Fonts)
