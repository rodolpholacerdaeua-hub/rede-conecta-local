# Player Windows — Manual Técnico

> Documentação técnica abrangente do player Electron para Digital Signage.
> Rede Conecta DOOH — Versão 20.1.0+

---

## Índice

1. [Arquitetura Geral](#arquitetura-geral)
2. [Main Process (Electron)](#main-process)
3. [Renderer Process (React)](#renderer-process)
4. [Cache Offline-First](#cache-offline-first)
5. [Video Transcoding](#video-transcoding)
6. [MediaProtocol](#mediaprotocol)
7. [Crash Guard](#crash-guard)
8. [Auto-Update](#auto-update)
9. [Blindagens de Produção](#blindagens-de-produção)
10. [Troubleshooting](#troubleshooting)

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────┐
│                   Electron App                       │
│                                                      │
│  ┌──────────────┐        ┌────────────────────────┐ │
│  │ Main Process │◄──IPC──│   Renderer (React)     │ │
│  │              │        │                        │ │
│  │ • CacheManager       │ • App.jsx (orquestrador)│ │
│  │ • VideoTranscoder    │ • WebMediaPlayer.jsx    │ │
│  │ • MediaProtocol      │ • SplashScreen.jsx      │ │
│  │ • CrashGuard         │ • PairingCodeDisplay    │ │
│  │ • AutoUpdater        │                        │ │
│  │ • IPC Handlers       │   <video> HTML5         │ │
│  └──────────────┘        └────────────────────────┘ │
│            │                        ▲                │
│            ▼                        │                │
│  ┌──────────────┐     ┌─────────────────────┐       │
│  │  SQLite DB   │     │ media-cache://       │       │
│  │  (cache.db)  │     │ Protocol Handler     │       │
│  └──────────────┘     └─────────────────────┘       │
│            │                        │                │
│            ▼                        ▽                │
│  ┌──────────────────────────────────────────┐       │
│  │   %APPDATA%/player-windows/media-cache/  │       │
│  │   └── media/                             │       │
│  │       ├── {uuid}_{hash}_h264.mp4         │       │
│  │       └── fallback_{hash}.bin            │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
              │                    ▲
              ▼                    │
    ┌──────────────────┐  ┌───────────────┐
    │  Supabase        │  │  GitHub       │
    │  • Auth          │  │  Releases     │
    │  • Realtime      │  │  (auto-update)│
    │  • Storage       │  │               │
    │  • PostgreSQL    │  │               │
    └──────────────────┘  └───────────────┘
```

### Fluxo de Dados

1. **Boot** → Main process inicia, registra `media-cache://` protocol
2. **Pairing** → Terminal obtém `terminal_id` via hardware ID
3. **Playlist** → Supabase Realtime envia playlist atualizada
4. **Cache Sync** → CacheManager baixa mídias, VideoTranscoder processa
5. **Playback** → `<video>` usa `media-cache://local/{file}` para reproduzir
6. **Loop** → WebMediaPlayer cicla entre os itens da playlist

---

## Main Process

**Arquivo**: `electron/main.js`

### Inicialização

```javascript
app.whenReady().then(async () => {
    // 1. Hardware ID (MAC-based)
    // 2. CrashGuard — detecta crash loops
    // 3. Migrator — migra entre versões
    // 4. Power Save Blocker — impede suspensão
    // 5. CacheManager — gerencia mídias locais
    // 6. MediaProtocol — serve arquivos via protocol handler
    // 7. IPC Handlers — bridge Main ↔ Renderer
    // 8. AutoUpdater — verifica atualizações
    // 9. Watchdog — mantém fullscreen/always-on-top
});
```

### IPC Handlers Principais

| Canal | Direção | Descrição |
|-------|---------|-----------|
| `cache-sync-playlist` | Renderer → Main | Sincroniza playlist com cache local |
| `cache-get-local-path` | Renderer → Main | Obtém path local de mídia em cache |
| `cache-progress` | Main → Renderer | Progresso de download |
| `get-hardware-id` | Renderer → Main | Retorna hardware ID do terminal |
| `get-app-version` | Renderer → Main | Retorna versão do app |

---

## Renderer Process

**Arquivo principal**: `src/App.jsx`

### Estados do Player

```
SPLASH → PAIRING → PLAYING → (STANDBY) → PLAYING
                                  ↑           │
                                  └───────────┘
```

| Estado | Descrição |
|--------|-----------|
| `SPLASH` | Tela de loading inicial (~3s) |
| `PAIRING` | Exibe código de pareamento via hardware ID |
| `PLAYING` | Reprodução ativa da playlist |
| `STANDBY` | Fora do horário de operação (tela preta) |

### WebMediaPlayer.jsx

Componente responsável pela reprodução de mídia. Usa `<video>` HTML5 nativo.

**Ciclo de reprodução:**

1. Recebe `playlistItems` e `cacheMap` como props
2. `getMediaUrl(item)` resolve URL: cache local vs. remoto
3. `<video>` reproduz via `media-cache://local/{filename}`
4. `onEnded` → avança para próximo item
5. `onError` → tenta fallback remoto → se falhar, marca como incompatível

**Lógica de fallback:**

```
Cache URL → ERRO → Remoto URL → ERRO → marca incompatível → skip
```

---

## Cache Offline-First

**Arquivo**: `electron/cacheManager.js`

### Estrutura

```
%APPDATA%/player-windows/media-cache/
├── cache.db          ← SQLite: índice de mídias
└── media/
    ├── {uuid}_{hash}_h264.mp4
    └── fallback_{hash}.bin
```

### Schema do SQLite

```sql
CREATE TABLE media_cache (
    media_id    TEXT PRIMARY KEY,
    url         TEXT,
    local_path  TEXT,
    file_size   INTEGER,
    downloaded_at TEXT,
    last_accessed TEXT
);
```

### Fluxo de Sync

```
syncPlaylist(items[])
  ├── Para cada item:
  │   ├── getLocalPath(mediaId) → existe no DB + disco?
  │   │   ├── SIM → retorna path (update last_accessed)
  │   │   └── NÃO → _downloadMedia()
  │   │              ├── _freeSpace() → LRU eviction se > 5GB
  │   │              ├── _downloadFile() → download HTTP
  │   │              ├── videoTranscoder.ensureH264() → transcode
  │   │              └── INSERT no SQLite (com path _h264.mp4)
  │   └── Map.set(mediaId, localPath)
  └── Retorna Map → convertido para Object via IPC
```

### Garbage Collection (LRU)

- **Limite**: 5GB de cache total
- **Estratégia**: Remove mídias menos acessadas (`ORDER BY last_accessed ASC`)
- **Trigger**: Antes de cada novo download

---

## Video Transcoding

**Arquivo**: `electron/videoTranscoder.js`

> [!IMPORTANT]
> **TODOS os vídeos são re-encoded** via `libx264` para garantir compatibilidade absoluta com o Chromium Embedded no Electron.

### Por quê?

O demuxer FFmpeg do Chromium é mais rigoroso que players standalone:

| Problema | Sintoma | Solução |
|----------|---------|---------|
| HEVC/H.265 | `SRC_NOT_SUPPORTED` | Transcode para H.264 |
| Container MP4 malformado | `BITSTREAM_CONVERSION_FAILED` | Re-encode reescreve container |
| Bitstream H.264 não-padrão | `BITSTREAM_CONVERSION_FAILED` | Re-encode gera NAL units limpos |
| VP9/AV1 sem suporte HW | Playback lento | Transcode para H.264 |

### Parâmetros FFmpeg

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 \
  -preset fast|medium \    # fast para H.264→H.264, medium para HEVC→H.264
  -crf 23 \                # Qualidade visual boa (~18-23 é range ideal)
  -profile:v main \        # Compatibilidade máxima com decoders HW
  -level 4.0 \             # Suporte amplo (1080p@30fps)
  -pix_fmt yuv420p \       # Formato de pixel universal
  -c:a aac \               # Audio AAC (universalmente suportado)
  -b:a 128k \
  -movflags +faststart \   # moov atom no início (essencial para streaming)
  -y output_h264.mp4
```

### Fluxo de Detecção

```
probeCodec(filePath)
  ├── Lê primeiros 8KB do arquivo
  ├── Busca markers: avc1/avc3 (H.264), hvc1/hev1 (HEVC), etc.
  └── Retorna { codec: string }
```

### Nomenclatura dos Arquivos

```
Original:     {uuid}_{hash}.mp4
Transcodado:  {uuid}_{hash}_h264.mp4
```

O original é deletado de forma lazy (setTimeout 5s) para evitar `EBUSY` se o MediaProtocol ainda estiver servindo.

### Dependência

```json
{
  "dependencies": {
    "ffmpeg-static": "^5.x"
  }
}
```

O `ffmpeg-static` fornece o binário ffmpeg pré-compilado para a plataforma. Em produção (app empacotado), o binário é incluído via `extraResources` do electron-builder.

---

## MediaProtocol

**Definido em**: `electron/main.js` → `setupMediaProtocol()`

### Registro do Esquema

```javascript
// ANTES do app.ready — obrigatório!
protocol.registerSchemesAsPrivileged([{
    scheme: 'media-cache',
    privileges: {
        standard: true,     // Resolve URLs via RFC 3986
        secure: true,       // Tratado como origem segura
        bypassCSP: true,    // Bypass de Content Security Policy
        supportFetchAPI: true,
        stream: true        // Suporte a streaming
    }
}]);
```

### Handler

```javascript
protocol.handle('media-cache', async (request) => {
    const url = new URL(request.url);
    const fileName = decodeURIComponent(url.pathname).substring(1);
    const filePath = path.join(userDataPath, 'media-cache', 'media', fileName);

    const fileUrl = pathToFileURL(filePath).toString();

    // CRÍTICO: repassar headers (Range) para net.fetch
    return net.fetch(fileUrl, {
        method: request.method,
        headers: request.headers,
    });
});
```

> [!CAUTION]
> **Sem `request.headers`**, o `net.fetch` não recebe o header `Range`, impedindo seeks no vídeo. Isso causa `BITSTREAM_CONVERSION_FAILED` intermitente porque o demuxer do Chromium não consegue pular para posições específicas no arquivo.

### URL Pattern

```
media-cache://local/{filename}_h264.mp4
          ↓
%APPDATA%/player-windows/media-cache/media/{filename}_h264.mp4
```

---

## Crash Guard

**Arquivo**: `electron/crashGuard.js`

Detecta crash loops e entra em safe mode após N crashes consecutivos.

| Parâmetro | Valor |
|-----------|-------|
| Crash threshold | 3 crashes |
| Stability timer | 60 segundos |
| Reset | Após 60s sem crash |

### Fluxo

```
Boot → checkCrashes()
  ├── crashes < threshold → iniciar stability timer
  │                          └── 60s sem crash → reset counter ✅
  └── crashes >= threshold → SAFE MODE
```

---

## Auto-Update

- Configurado via `electron-builder` + GitHub Releases
- Verifica atualizações no boot e a cada 30 minutos
- Download silencioso em background
- Instalação no próximo restart

---

## Blindagens de Produção

| Blindagem | Mecanismo | Arquivo |
|-----------|-----------|---------|
| Always-on-Top | `mainWindow.setAlwaysOnTop(true, 'screen-saver')` | main.js |
| Fullscreen forçado | Watchdog verifica a cada 10s | main.js |
| Anti-suspensão | `powerSaveBlocker.start('prevent-display-sleep')` | main.js |
| Prioridade alta | `wmic` + processo priority | platformUtils.js |
| Boot atrasado | Detecta e loga atrasos > 5min | main.js |
| Single instance | `app.requestSingleInstanceLock()` | main.js |

---

## Troubleshooting

### DEMUXER_ERROR_BITSTREAM_CONVERSION_FAILED

**Causa**: Arquivo de vídeo com container/bitstream incompatível com Chromium.

**Verificação**:
```bash
# Verificar codec do arquivo
ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 arquivo.mp4

# Se retornar h264 mas ainda der erro → container malformado
# Solução: forçar re-transcode deletando o arquivo do cache
```

**Fix permanente**: O VideoTranscoder já faz full transcode de todos os vídeos.

### Vídeo não reproduz (SRC_NOT_SUPPORTED)

**Causa**: Codec HEVC/VP9/AV1 não suportado pelo Chromium.

**Verificação**: Checar se o `_h264.mp4` existe no cache.

### Cache não sincroniza

**Verificação**:
```bash
# Checar DB
sqlite3 "%APPDATA%/player-windows/media-cache/cache.db" "SELECT * FROM media_cache;"

# Checar arquivos
dir "%APPDATA%\player-windows\media-cache\media\"
```

### Player fica em tela preta

**Possíveis causas**:
1. Modo standby (fora do horário de operação)
2. Playlist vazia
3. Todos os itens marcados como incompatíveis → verificar `failedItemsRef`

---

## Changelog

### v20.1.0 — Saneamento de Falhas no Player (2026-02-09)

- **Full transcode universal**: todos os vídeos re-encoded via libx264
- **MediaProtocol Range requests**: headers repassados para net.fetch
- **Remoção do MPV**: playback 100% via HTML5 `<video>`
- **ffmpeg-static**: transcodificação durante cache sync
