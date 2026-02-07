/**
 * Video Transcoder - Converte vídeos H.265/HEVC para H.264/AVC automaticamente
 * Usa ffmpeg.wasm para rodar no browser sem servidor
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance = null;
let ffmpegLoading = false;

/**
 * Inicializar ffmpeg.wasm (singleton, carrega uma vez)
 */
async function getFFmpeg(onProgress) {
    if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
    if (ffmpegLoading) {
        // Esperar se outro processo já está carregando
        while (ffmpegLoading) {
            await new Promise(r => setTimeout(r, 100));
        }
        return ffmpegInstance;
    }

    ffmpegLoading = true;
    try {
        const ffmpeg = new FFmpeg();

        // Log de progresso do ffmpeg
        ffmpeg.on('log', ({ message }) => {
            console.log('[ffmpeg]', message);
        });

        ffmpeg.on('progress', ({ progress, time }) => {
            const pct = Math.round(progress * 100);
            console.log(`[ffmpeg] Progresso: ${pct}% (${(time / 1000000).toFixed(1)}s)`);
            if (onProgress) onProgress(pct);
        });

        // Carregar ffmpeg core via CDN
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        ffmpegInstance = ffmpeg;
        return ffmpeg;
    } finally {
        ffmpegLoading = false;
    }
}

/**
 * Detectar se um arquivo de vídeo precisa transcodificação
 * Lê os primeiros bytes do container MP4 para encontrar o codec
 * @param {File} file - Arquivo de vídeo
 * @returns {Promise<{needsTranscode: boolean, codec: string}>}
 */
export async function detectVideoCodec(file) {
    // Ler primeiros 128KB para encontrar codec info
    const slice = file.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const ascii = String.fromCharCode(...bytes);

    // Procurar identificadores de codec no container MP4
    if (ascii.includes('avc1') || ascii.includes('avc3')) {
        return { needsTranscode: false, codec: 'H.264/AVC' };
    }
    if (ascii.includes('hev1') || ascii.includes('hvc1')) {
        return { needsTranscode: true, codec: 'H.265/HEVC' };
    }
    if (ascii.includes('vp09')) {
        return { needsTranscode: true, codec: 'VP9' };
    }
    if (ascii.includes('av01')) {
        return { needsTranscode: true, codec: 'AV1' };
    }

    // Se não encontrou no header, pode ter moov at end — assumir que precisa
    // Apenas para arquivos .mp4/.mov que são vídeo
    const ext = file.name.toLowerCase().split('.').pop();
    if (['mp4', 'mov', 'mkv', 'webm', 'avi'].includes(ext)) {
        // Sem certeza do codec — tentar transcodificar por segurança
        return { needsTranscode: true, codec: 'Desconhecido' };
    }

    return { needsTranscode: false, codec: 'N/A' };
}

/**
 * Transcodificar vídeo para H.264/AAC
 * @param {File} file - Arquivo de vídeo original
 * @param {function} onProgress - Callback de progresso (0-100)
 * @returns {Promise<File>} - Arquivo transcodificado
 */
export async function transcodeToH264(file, onProgress) {
    console.log(`[Transcoder] Iniciando conversão: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    const ffmpeg = await getFFmpeg(onProgress);

    const inputName = 'input' + getExtension(file.name);
    const outputName = 'output.mp4';

    // Escrever arquivo original na memória do ffmpeg
    const fileData = await fetchFile(file);
    await ffmpeg.writeFile(inputName, fileData);

    // Transcodificar: H.264 + AAC + faststart (moov at beginning)
    await ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y', outputName
    ]);

    // Ler resultado
    const data = await ffmpeg.readFile(outputName);

    // Limpar memória
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Criar novo File com o mesmo nome mas conteúdo H.264
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newFile = new File([data.buffer], `${baseName}.mp4`, {
        type: 'video/mp4'
    });

    console.log(`[Transcoder] Conversão completa: ${(newFile.size / 1024 / 1024).toFixed(1)}MB`);

    return newFile;
}

/**
 * Processar arquivo de vídeo — detecta codec e converte se necessário
 * @param {File} file - Arquivo de vídeo
 * @param {function} onProgress - Callback de progresso (0-100)
 * @param {function} onStatus - Callback de status (string message)
 * @returns {Promise<{file: File, wasTranscoded: boolean, originalCodec: string}>}
 */
export async function processVideoFile(file, onProgress, onStatus) {
    // Verificar se é vídeo
    if (!file.type.startsWith('video/')) {
        return { file, wasTranscoded: false, originalCodec: 'N/A (imagem)' };
    }

    if (onStatus) onStatus('Analisando codec do vídeo...');
    const { needsTranscode, codec } = await detectVideoCodec(file);

    if (!needsTranscode) {
        console.log(`[Transcoder] Vídeo já é ${codec} — sem necessidade de conversão`);
        if (onStatus) onStatus(null);
        return { file, wasTranscoded: false, originalCodec: codec };
    }

    console.log(`[Transcoder] Vídeo é ${codec} — conversão necessária para H.264`);
    if (onStatus) onStatus(`Convertendo ${codec} → H.264...`);

    const transcodedFile = await transcodeToH264(file, onProgress);

    if (onStatus) onStatus(null);
    return { file: transcodedFile, wasTranscoded: true, originalCodec: codec };
}

function getExtension(filename) {
    const ext = filename.split('.').pop();
    return ext ? `.${ext}` : '.mp4';
}
