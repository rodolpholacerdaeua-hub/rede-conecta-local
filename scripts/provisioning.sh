#!/bin/bash

# ==============================================================================
# CONFIGURAÇÃO DE MODO
# ------------------------------------------------------------------------------
# MODO="native" -> Instala e roda o Player Electron (.deb)
# MODO="web"    -> Roda o Chromium apontando para um IP de desenvolvimento
MODO="web"
DEV_SERVER_URL="http://192.168.1.97:5173" # IP do seu Windows encontrado via ipconfig
# ==============================================================================

set -e # Aborta se qualquer comando falhar

echo "🚀 Iniciando provisionamento do terminal Rede Conecta [$MODO]..."

# 1. Atualização do Sistema
echo "📦 Atualizando repositórios e sistema..."
sudo apt update && sudo apt upgrade -y

# 2. Instalação de Dependências de Interface e Player
echo "🖥️ Instalando stack Kiosk (Xorg + Openbox + Dependências)..."
sudo apt install -y \
    xserver-xorg \
    xinit \
    openbox \
    lightdm \
    x11-xserver-utils \
    curl \
    wget \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    mpv \
    chromium-browser

# 3. Configuração de Autologin (LightDM)
echo "🔑 Configurando Auto-login para o usuário 'conecta'..."
sudo mkdir -p /etc/lightdm/lightdm.conf.d/
cat <<EOF | sudo tee /etc/lightdm/lightdm.conf.d/autologin.conf
[Seat:*]
autologin-user=conecta
autologin-user-timeout=0
user-session=openbox
EOF

# 4. Configuração do Ambiente Gráfico (Openbox)
echo "⚙️ Configurando Autostart do Openbox..."
mkdir -p ~/.config/openbox
if [ "$MODO" = "native" ]; then
    PLAYER_EXEC="/usr/bin/rede-conecta-player --no-sandbox --kiosk &"
else
    PLAYER_EXEC="chromium-browser --kiosk --no-first-run --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required '$DEV_SERVER_URL' &"
fi

cat <<EOF > ~/.config/openbox/autostart
# Desativar protetor de tela e gerenciamento de energia
xset s off
xset s noblank
xset -dpms

# Lançar o Player conforme o modo selecionado
$PLAYER_EXEC
EOF

# 5. Instalação do Player (Versão mais recente via GitHub - Apenas modo Native)
if [ "$MODO" = "native" ]; then
    echo "📥 Buscando última versão do Player (.deb) no GitHub..."
    LATEST_DEB_URL=$(curl -s https://api.github.com/repos/rodolpholacerdaeua-hub/rede-conecta-local/releases/latest | grep "browser_download_url.*deb" | cut -d '"' -f 4)

    if [ -z "$LATEST_DEB_URL" ]; then
        echo "⚠️  Não foi possível encontrar um pacote .deb na última release do GitHub."
        echo "Assumindo que você copiará o arquivo manualmente para /tmp/player.deb"
    else
        echo "⬇️ Baixando $LATEST_DEB_URL..."
        wget -O /tmp/player.deb "$LATEST_DEB_URL"
    fi

    if [ -f /tmp/player.deb ]; then
        echo "📦 Instalando Player..."
        sudo dpkg -i /tmp/player.deb || sudo apt install -f -y
    fi
fi

echo "✅ Provisionamento concluído com sucesso no modo: $MODO"
echo "⚠️  Recomenda-se reiniciar o terminal agora: sudo reboot"
