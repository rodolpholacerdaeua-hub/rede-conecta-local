/**
 * VideoTranscoder - Processamento de vídeo para compatibilidade Chromium
 * Rede Conecta DOOH - Garantia absoluta de reprodução
 * 
 * TODOS os vídeos são re-encoded pelo ffmpeg para H.264 Baseline/Main Profile.
 * Isso garante: container MP4 limpo, bitstream válido, sem BITSTREAM_CONVERSION_FAILED.
 * 
 * NÃO interfere no playback — roda como processo background durante cache sync.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// ffmpeg-static fornece o caminho para o binário ffmpeg
let ffmpegPath;
try {
    ffmpegPath = require('ffmpeg-static');
} catch (e) {
    console.warn('[VideoTranscoder] ffmpeg-static não encontrado. Transcodificação desabilitada.');
    ffmpegPath = null;
}

/**
 * Detectar codec de vídeo lendo os atoms do MP4
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<{codec: string}>}
 */
async function probeCodec(filePath) {
    return new Promise((resolve) => {
        try {
            const fd = fs.openSync(filePath, 'r');
            const buf = Buffer.alloc(8192);
            const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
            fs.closeSync(fd);

            const data = buf.slice(0, bytesRead);

            const codecs = {
                'avc1': 'h264', 'avc3': 'h264',
                'hvc1': 'hevc', 'hev1': 'hevc',
                'vp08': 'vp8', 'vp09': 'vp9', 'av01': 'av1',
            };

            for (const [marker, codec] of Object.entries(codecs)) {
                if (data.includes(Buffer.from(marker, 'ascii'))) {
                    console.log(`[VideoTranscoder] Detected codec: ${codec} (${marker})`);
                    return resolve({ codec });
                }
            }
            resolve({ codec: 'unknown' });
        } catch (err) {
            console.warn(`[VideoTranscoder] Probe error: ${err.message}`);
            resolve({ codec: 'unknown' });
        }
    });
}

/**
 * Processar vídeo para garantir compatibilidade absoluta com Chromium.
 * TODOS os vídeos são re-encoded — não apenas HEVC.
 * 
 * @param {string} inputPath - Caminho do vídeo original
 * @param {string} mediaName - Nome da mídia (para logs)
 * @returns {Promise<string>} - Caminho do vídeo processado
 */
async function ensureH264(inputPath, mediaName = '') {
    if (!ffmpegPath) {
        console.warn('[VideoTranscoder] ffmpeg not available, skipping');
        return inputPath;
    }

    // Verificar se é um arquivo de vídeo
    const ext = path.extname(inputPath).toLowerCase();
    const videoExts = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.wmv', '.flv'];
    if (!videoExts.includes(ext)) {
        return inputPath;
    }

    // Se já é um arquivo processado (_h264.mp4), não reprocessar
    if (inputPath.includes('_h264.mp4')) {
        console.log(`[VideoTranscoder] "${mediaName}" already processed, skipping`);
        return inputPath;
    }

    // Probe do codec (para logging)
    const { codec } = await probeCodec(inputPath);

    // Gerar caminho de saída
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, ext);
    const outputPath = path.join(dir, `${baseName}_h264.mp4`);

    // Escolher preset baseado no codec:
    // H.264→H.264: 'fast' (mais rápido, qualidade similar)
    // HEVC→H.264: 'medium' (melhor qualidade de re-encode)
    const preset = codec === 'h264' ? 'fast' : 'medium';

    console.log(`[VideoTranscoder] 🔄 Processing "${mediaName}" (${codec} → H.264, preset=${preset})...`);
    const startTime = Date.now();

    return new Promise((resolve) => {
        const args = [
            '-i', inputPath,
            '-c:v', 'libx264',
            '-preset', preset,
            '-crf', '23',
            '-profile:v', 'main',
            '-level', '4.0',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-y',
            outputPath
        ];

        const proc = execFile(ffmpegPath, args, {
            timeout: 15 * 60 * 1000 // 15 minutos max
        }, (err) => {
            if (err) {
                console.error(`[VideoTranscoder] ❌ Failed for "${mediaName}": ${err.message}`);
                try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) { /* ignore */ }
                return resolve(inputPath); // Retornar original como último recurso
            }

            try {
                const stats = fs.statSync(outputPath);
                if (stats.size < 1024) {
                    console.error(`[VideoTranscoder] ❌ Output too small: ${stats.size} bytes`);
                    fs.unlinkSync(outputPath);
                    return resolve(inputPath);
                }

                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
                console.log(`[VideoTranscoder] ✅ Done "${mediaName}": ${codec}→H.264 (${sizeMB}MB, ${elapsed}s)`);

                // Deletar original de forma lazy
                setTimeout(() => {
                    try {
                        if (fs.existsSync(inputPath)) {
                            fs.unlinkSync(inputPath);
                            console.log(`[VideoTranscoder] 🧹 Cleaned: ${path.basename(inputPath)}`);
                        }
                    } catch (e) { /* ignore */ }
                }, 5000);

                resolve(outputPath);
            } catch (e) {
                console.error(`[VideoTranscoder] ❌ Post-process error: ${e.message}`);
                resolve(inputPath);
            }
        });

        // Log de progresso
        if (proc.stderr) {
            let lastLog = 0;
            proc.stderr.on('data', (data) => {
                const now = Date.now();
                if (now - lastLog > 5000) {
                    const timeMatch = data.toString().match(/time=(\S+)/);
                    if (timeMatch) {
                        console.log(`[VideoTranscoder] Progress "${mediaName}": ${timeMatch[1]}`);
                    }
                    lastLog = now;
                }
            });
        }
    });
}

module.exports = { probeCodec, ensureH264 };
