---
name: video-transcoding
description: "Video transcoding patterns for Electron/Chromium playback. H.264 compatibility, MediaProtocol range requests, ffmpeg-static integration, cache management, and troubleshooting BITSTREAM_CONVERSION_FAILED errors."
skills: []
---

# Video Transcoding Skill

> Garantia de reprodução de vídeo em Electron/Chromium via ffmpeg-static.

---

## Contexto

O Chromium Embedded (usado pelo Electron) tem um FFmpegDemuxer **muito mais rigoroso** que players standalone (VLC, MPV, FFprobe). Isso significa que vídeos que abrem normalmente em qualquer player podem falhar no Electron com:

- `DEMUXER_ERROR_BITSTREAM_CONVERSION_FAILED` — bitstream/container malformado
- `SRC_NOT_SUPPORTED` — codec não suportado (HEVC, VP9, AV1)

---

## Princípio #1: Full Transcode Universal

> **NUNCA confie no codec reportado pelo FFprobe.** Sempre re-encode.

```javascript
// ❌ ERRADO: pular H.264 porque "já é compatível"
if (codec === 'h264') return inputPath;

// ✅ CORRETO: re-encode TODOS os vídeos
// H.264 com container malformado → BITSTREAM_CONVERSION_FAILED
// H.264 com NAL units não-padrão → demuxer falha
```

### Decisão de Preset

| Codec original | Preset ffmpeg | Razão |
|---------------|---------------|-------|
| H.264 → H.264 | `fast` | Qualidade similar, mais rápido |
| HEVC → H.264 | `medium` | Melhor qualidade de re-encode |
| Desconhecido → H.264 | `medium` | Segurança |

---

## Princípio #2: Parâmetros FFmpeg Seguros

```bash
ffmpeg -i input \
  -c:v libx264 \
  -profile:v main \       # NÃO usar high — alguns HW decoders falham
  -level 4.0 \            # 1080p@30fps — suporte universal
  -pix_fmt yuv420p \      # OBRIGATÓRIO — sem isso, Chrome rejeita
  -crf 23 \               # range 18-28, 23 = boa qualidade
  -c:a aac -b:a 128k \    # Audio AAC — universalmente suportado
  -movflags +faststart \  # moov atom no início — ESSENCIAL para streaming
  -y output_h264.mp4
```

### Parâmetros NUNCA usar

| Parâmetro | Razão |
|-----------|-------|
| `-profile:v high` | Alguns HW decoders mobile falham |
| `-pix_fmt yuv444p` | Chrome não suporta |
| `-c:v copy` (remux) | NÃO corrige bitstream malformado |
| Sem `-movflags +faststart` | Demuxer precisa seek até o fim do arquivo |

---

## Princípio #3: MediaProtocol com Range Requests

> **O header `Range` é OBRIGATÓRIO** para playback de vídeo via protocolo customizado.

```javascript
// ❌ ERRADO: net.fetch sem headers
protocol.handle('scheme', (request) => {
    return net.fetch(fileUrl);
});

// ✅ CORRETO: repassar method + headers
protocol.handle('scheme', async (request) => {
    return net.fetch(fileUrl, {
        method: request.method,
        headers: request.headers, // Range header é CRÍTICO
    });
});
```

**Por quê?** O `<video>` envia `Range: bytes=X-Y` para seek. Sem repassar, o demuxer recebe o arquivo inteiro sem poder pular para posições específicas → `BITSTREAM_CONVERSION_FAILED`.

### Registro do Esquema

```javascript
// ANTES do app.ready!
protocol.registerSchemesAsPrivileged([{
    scheme: 'media-cache',
    privileges: {
        standard: true,
        secure: true,
        bypassCSP: true,
        supportFetchAPI: true,
        stream: true
    }
}]);
```

---

## Princípio #4: Nomenclatura e Cleanup

### Naming Convention

```
Download:     {uuid}_{hash}.mp4         ← original
Transcoded:   {uuid}_{hash}_h264.mp4    ← processado
```

O sufixo `_h264` serve como flag: se já tem `_h264.mp4`, não reprocessar.

### Cleanup Seguro

```javascript
// ❌ ERRADO: deletar original imediatamente
fs.unlinkSync(inputPath); // EBUSY se MediaProtocol está servindo

// ✅ CORRETO: deletar de forma lazy
setTimeout(() => {
    try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch (e) { /* cleanup posterior */ }
}, 5000);
```

---

## Princípio #5: Detecção de Codec

### Via Atoms do MP4 (rápido, ~1ms)

```javascript
// Ler primeiros 8KB → buscar markers ASCII
const markers = {
    'avc1': 'h264', 'avc3': 'h264',   // H.264
    'hvc1': 'hevc', 'hev1': 'hevc',   // H.265
    'vp08': 'vp8',  'vp09': 'vp9',    // VP8/9
    'av01': 'av1',                      // AV1
};
```

### Via FFprobe (fallback, ~100ms)

```bash
ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 file.mp4
```

---

## Princípio #6: Integração com Cache

O transcode deve rodar **DEPOIS do download** e **ANTES do registro no DB**:

```
_downloadMedia()
  ├── 1. Download HTTP → {uuid}_{hash}.mp4
  ├── 2. videoTranscoder.ensureH264() → {uuid}_{hash}_h264.mp4
  ├── 3. Atualizar destPath para _h264.mp4
  ├── 4. Atualizar size (stat do novo arquivo)
  └── 5. INSERT no SQLite com destPath correto
```

> [!CAUTION]
> Se o DB armazenar o path original (sem `_h264`), `getLocalPath()` retornará `null` na próxima inicialização, causando re-download desnecessário.

---

## Troubleshooting Rápido

| Erro | Causa provável | Solução |
|------|---------------|---------|
| `BITSTREAM_CONVERSION_FAILED` | Bitstream/container malformado OU falta Range | Full transcode + verificar MediaProtocol headers |
| `SRC_NOT_SUPPORTED` | Codec HEVC/VP9/AV1 | Transcode para H.264 |
| `NETWORK_ERROR` | Download falhou ou file not found | Verificar cache DB + disco |
| Vídeo toca mas sem áudio | Audio codec incompatível | Re-encode com `-c:a aac` |
| Playback lento | Sem HW acceleration | Verificar `--enable-gpu-rasterization` |
| `EBUSY` ao deletar | Arquivo em uso pelo MediaProtocol | Usar cleanup lazy com setTimeout |

---

## Dependências

| Pacote | Versão | Uso |
|--------|--------|-----|
| `ffmpeg-static` | ^5.x | Binário ffmpeg pré-compilado |
| `better-sqlite3` | ^11.x | SQLite para cache index |

### Build (electron-builder)

```json
{
  "extraResources": [
    {
      "from": "node_modules/ffmpeg-static/ffmpeg.exe",
      "to": "ffmpeg.exe"
    }
  ]
}
```
