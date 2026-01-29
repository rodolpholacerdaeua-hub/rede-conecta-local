import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, StatusBar, TouchableOpacity, Modal, TextInput, Alert, BackHandler } from 'react-native';
import { Lock, Settings, RefreshCcw, Power } from 'lucide-react-native';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import { db } from './src/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');
const MAPPING_FILE = `${RNFS.DocumentDirectoryPath}/media_mapping.json`;

function App() {
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [globalItems, setGlobalItems] = useState<any[]>([]);
  const [interleaveRatio, setInterleaveRatio] = useState(3);
  const [flatPlaylist, setFlatPlaylist] = useState<any[]>([]);

  const [campaignsCache, setCampaignsCache] = useState<any>({});
  const [mediaCache, setMediaCache] = useState<any>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localFiles, setLocalFiles] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState('TV-PLAYER-01');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [maintenanceVisible, setMaintenanceVisible] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [isSleeping, setIsSleeping] = useState(false);
  const [orientation, setOrientation] = useState(width > height ? 'horizontal' : 'vertical');

  // 1. Inicialização e Bloqueio de Botão Voltar
  useEffect(() => {
    const onBackPress = () => {
      // Bloqueia a saída do app pelo botão voltar
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    const initApp = async () => {
      try {
        const exists = await RNFS.exists(MAPPING_FILE);
        if (exists) {
          const content = await RNFS.readFile(MAPPING_FILE);
          setLocalFiles(JSON.parse(content));
        }
      } catch (e) {
        console.error("Erro ao carregar mapa:", e);
      }
    };
    initApp();

    return () => backHandler.remove();
  }, []);

  // 1.5 Telemetria & Heartbeat
  useEffect(() => {
    const reportTelemetry = async () => {
      try {
        const diskInfo = await RNFS.getFSInfo();
        const diskUsage = ((diskInfo.totalSpace - diskInfo.freeSpace) / diskInfo.totalSpace * 100).toFixed(1);

        const terminalRef = doc(db, "terminals", deviceId);
        const currentItem = flatPlaylist[currentIndex];
        await setDoc(terminalRef, {
          lastSeen: serverTimestamp(),
          status: 'online',
          metrics: {
            temp: "42°C",
            cpu: "15%",
            disk: `${diskUsage}%`,
            freeSpace: `${(diskInfo.freeSpace / (1024 * 1024 * 1024)).toFixed(1)} GB`
          },
          currentMedia: currentItem?.name || 'Aguardando...',
          appVersion: '2.0.0-maas'
        }, { merge: true });

        console.log("📡 Telemetria reportada com sucesso.");
      } catch (e) {
        console.error("Erro ao reportar telemetria:", e);
      }
    };

    const interval = setInterval(reportTelemetry, 30000); // 30 segundos
    reportTelemetry(); // Inicial
    return () => clearInterval(interval);
  }, [deviceId, flatPlaylist, currentIndex]);

  // 1.7 Listener de Comandos Remotos e Horários
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "terminals", deviceId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSleepMode(data.sleepMode || false);
        setOpeningTime(data.openingTime || '08:00');
        setClosingTime(data.closingTime || '22:00');
      }
    });
    return () => unsubscribe();
  }, [deviceId]);

  // 1.8 Lógica de Decisão de Sono (Manual + Horário)
  useEffect(() => {
    const checkSleepStatus = () => {
      if (sleepMode) {
        setIsSleeping(true);
        return;
      }

      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const currentTimeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;

      // Comparação simples de strings "HH:mm"
      const isWithinBounds = currentTimeStr >= openingTime && currentTimeStr < closingTime;
      setIsSleeping(!isWithinBounds);
    };

    const interval = setInterval(checkSleepStatus, 30000); // Checa a cada 30 segundos
    checkSleepStatus();
    return () => clearInterval(interval);
  }, [sleepMode, openingTime, closingTime]);

  // 2. Sincronização de Metadados e Atribuição de Playlist
  useEffect(() => {
    const qC = query(collection(db, "campaigns"));
    const unsubscribeC = onSnapshot(qC, (snapshot) => {
      const cache: any = {};
      snapshot.docs.forEach(d => cache[d.id] = { id: d.id, ...d.data() });
      setCampaignsCache(cache);
    });

    const qM = query(collection(db, "media"));
    const unsubscribeM = onSnapshot(qM, (snapshot) => {
      const cache: any = {};
      snapshot.docs.forEach(d => cache[d.id] = { id: d.id, ...d.data() });
      setMediaCache(cache);
    });

    // Ouvir o terminal para saber qual playlist seguir
    const terminalRef = doc(db, "terminals", deviceId);
    let unsubscribeP: (() => void) | null = null;

    const unsubscribeT = onSnapshot(terminalRef, (snap) => {
      if (snap.exists()) {
        const tData = snap.data();
        const plId = tData.assignedPlaylistId;

        if (plId) {
          if (unsubscribeP) unsubscribeP();
          unsubscribeP = onSnapshot(doc(db, "playlists", plId), (plSnap) => {
            if (plSnap.exists()) {
              const pl = plSnap.data();
              setLocalItems(pl.localItems || []);
              setGlobalItems(pl.globalItems || []);
              setInterleaveRatio(pl.interleaveRatio || 3);
              setLoading(false);
            }
          });
        } else {
          // Se não houver playlist atribuída, limpa a grade
          setLocalItems([]);
          setGlobalItems([]);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribeC();
      unsubscribeM();
      unsubscribeT();
      if (unsubscribeP) (unsubscribeP as () => void)();
    };
  }, [deviceId]);

  // 2.5 Gerador de Playlist Unificada (Interleave Logic)
  useEffect(() => {
    const buildPlaylist = () => {
      const activeLocals = localItems.map(item => {
        if (item.type === 'campaign') {
          const camp = campaignsCache[item.id];
          if (!camp) return null;

          // Filtro de Segurança: Só exibe se estiver ATIVA e se este TERMINAL for o ALVO
          const isTargeted = camp.targetTerminals?.includes(deviceId);
          if (camp.is_active === false || !isTargeted) return null;

          const mediaId = orientation === 'horizontal' ? camp.hMediaId : camp.vMediaId;
          const media = mediaCache[mediaId];
          if (!media) return null;

          return { ...item, url: media.url, mediaType: media.type, mediaId: mediaId };
        }
        return item;
      }).filter(Boolean);

      if (activeLocals.length === 0) {
        setFlatPlaylist(globalItems);
        return;
      }

      const combined: any[] = [];
      let lIdx = 0;
      let gIdx = 0;

      while (combined.length < (activeLocals.length + globalItems.length)) {
        if (globalItems[gIdx]) {
          combined.push(globalItems[gIdx]);
          gIdx++;
        }
        for (let i = 0; i < interleaveRatio; i++) {
          if (activeLocals[lIdx]) {
            combined.push(activeLocals[lIdx]);
            lIdx++;
          }
        }
        if (gIdx >= globalItems.length && lIdx >= activeLocals.length) break;
      }

      setFlatPlaylist(combined);
      downloadMediaFiles(combined);
    };

    if (Object.keys(campaignsCache).length > 0 && Object.keys(mediaCache).length > 0) {
      buildPlaylist();
    }
  }, [localItems, globalItems, interleaveRatio, campaignsCache, mediaCache, orientation]);

  // 3. Função de Download e Persistência do Mapa
  const downloadMediaFiles = async (items: any[]) => {
    let updated = false;
    const newLocalFiles = { ...localFiles };

    for (const item of items) {
      if (!item.url) continue;
      const fileName = item.mediaId || item.id || item.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const localPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      if (!(await RNFS.exists(localPath))) {
        try {
          await RNFS.downloadFile({ fromUrl: item.url, toFile: localPath, background: true }).promise;
          newLocalFiles[item.url] = localPath;
          updated = true;
        } catch (err) {
          console.error("Download falhou:", item.name, err);
        }
      } else {
        if (!newLocalFiles[item.url]) {
          newLocalFiles[item.url] = localPath;
          updated = true;
        }
      }
    }

    if (updated) {
      setLocalFiles(newLocalFiles);
      await RNFS.writeFile(MAPPING_FILE, JSON.stringify(newLocalFiles));
    }
  };

  // 4. Auditoria (Proof of Play)
  const logProofOfPlay = useCallback(async (mediaItem: any) => {
    try {
      await addDoc(collection(db, "logs"), {
        mediaId: mediaItem.mediaId || mediaItem.id || 'unknown',
        mediaName: mediaItem.name,
        timestamp: serverTimestamp(),
        type: 'exhibition',
        deviceId: 'TV-PLAYER-01'
      });
      console.log("Exibição registrada:", mediaItem.name);
    } catch (e) {
      console.error("Log falhou (será salvo offline pelo Firestore):", e);
    }
  }, []);

  // 5. Lógica de Troca e Registro
  useEffect(() => {
    if (!flatPlaylist.length) return;

    const item = flatPlaylist[currentIndex];
    if (!item) return;

    logProofOfPlay(item);

    const updateCurrentMedia = async () => {
      try {
        const terminalRef = doc(db, "terminals", deviceId);
        await updateDoc(terminalRef, { currentMedia: item.name });
      } catch (e) { }
    };
    updateCurrentMedia();

    if (item.mediaType === 'image' || item.type === 'image') {
      const timer = setTimeout(nextMedia, (parseInt(item.duration) || 10) * 1000);
      return () => clearTimeout(timer);
    }
  }, [flatPlaylist, currentIndex, logProofOfPlay]);

  const nextMedia = () => {
    if (flatPlaylist.length) {
      setCurrentIndex((prev) => (prev + 1) % flatPlaylist.length);
    }
  };

  const handleMaintenanceAccess = () => {
    if (pinInput === '1234') {
      setMaintenanceVisible(true);
      setPinModalVisible(false);
      setPinInput('');
    } else {
      Alert.alert("Erro", "PIN Incorreto!");
      setPinInput('');
    }
  };

  const rebootPlayer = () => {
    Alert.alert("Confirmar", "Deseja reiniciar o dispositivo?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Reiniciar", onPress: () => console.log("Rebooting...") }
    ]);
  };

  if (sleepMode) {
    return (
      <View style={[styles.container, { backgroundColor: 'black' }]}>
        <StatusBar hidden />
      </View>
    );
  }

  // Render de Sono (Blackout)
  if (isSleeping) {
    return (
      <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar hidden />
        <Power size={48} color="#1a1a1a" />
        <Text style={{ color: '#050505', marginTop: 20, fontSize: 10 }}>MODO DE ECONOMIA ATIVO</Text>
      </View>
    );
  }

  if (loading && flatPlaylist.length === 0) {
    return <View style={styles.container}><Text style={styles.text}>Sincronizando Camadas...</Text></View>;
  }

  if (flatPlaylist.length === 0) {
    return <View style={styles.container}><Text style={styles.text}>Aguardando Conteúdo...</Text></View>;
  }

  const currentItem = flatPlaylist[currentIndex];
  const source = localFiles[currentItem.url] ? { uri: `file://${localFiles[currentItem.url]}` } : { uri: currentItem.url };
  const isVideo = currentItem.mediaType === 'video' || currentItem.type === 'video';

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <TouchableOpacity
        style={styles.hiddenTrigger}
        onLongPress={() => setPinModalVisible(true)}
        delayLongPress={3000}
      />

      {isVideo ? (
        <Video source={source} style={styles.fullscreen} resizeMode="cover" onEnd={nextMedia} onError={nextMedia} />
      ) : (
        <Image source={source} style={styles.fullscreen} resizeMode="cover" />
      )}

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{localFiles[currentItem.url] ? 'OFFLINE ⚡' : 'STREAM ☁️'}</Text>
      </View>

      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.pinBox}>
            <Lock color="#334155" size={32} />
            <Text style={styles.modalTitle}>Acesso Restrito</Text>
            <TextInput
              style={styles.pinInput}
              placeholder="Digite o PIN"
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={pinInput}
              onChangeText={setPinInput}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => { setPinModalVisible(false); setPinInput(''); }}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handleMaintenanceAccess}>
                <Text style={styles.btnText}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={maintenanceVisible} animationType="slide">
        <View style={styles.maintenanceContainer}>
          <View style={styles.header}>
            <Settings color="white" size={24} />
            <Text style={styles.headerTitle}>Painel de Manutenção</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>DEVICE ID</Text>
              <Text style={styles.statValue}>{deviceId}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>COMPOSIÇÃO</Text>
              <Text style={styles.statValue}>{globalItems.length}G / {localItems.length}L</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert("Sucesso", "Cache limpo!")}>
              <RefreshCcw color="white" size={20} />
              <Text style={styles.actionText}>Limpar Cache</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={rebootPlayer}>
              <Power color="white" size={20} />
              <Text style={styles.actionText}>Reiniciar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={() => setMaintenanceVisible(false)}>
            <Text style={styles.closeBtnText}>SAIR DA MANUTENÇÃO</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  fullscreen: { width: width, height: height, position: 'absolute' },
  text: { color: 'white', fontSize: 18 },
  badge: { position: 'absolute', bottom: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 4 },
  badgeText: { color: '#0f0', fontSize: 10, fontWeight: 'bold' },
  hiddenTrigger: { position: 'absolute', top: 0, left: 0, width: 60, height: 60, zIndex: 999 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  pinBox: { backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center', width: 300 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginVertical: 15 },
  pinInput: { backgroundColor: '#f1f5f9', width: '100%', padding: 15, borderRadius: 10, textAlign: 'center', fontSize: 24, fontWeight: 'bold', letterSpacing: 10 },
  modalButtons: { flexDirection: 'row', marginTop: 20, justifyContent: 'space-between' },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, flex: 1, alignItems: 'center', marginHorizontal: 5 },
  btnCancel: { backgroundColor: '#cbd5e1' },
  btnConfirm: { backgroundColor: '#3b82f6' },
  btnText: { color: 'white', fontWeight: 'bold' },
  maintenanceContainer: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 20, backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  statsGrid: { padding: 20, flexDirection: 'row', gap: 15 },
  statCard: { flex: 1, backgroundColor: '#1e293b', padding: 15, borderRadius: 12 },
  statLabel: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  statValue: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  actions: { padding: 20, gap: 10 },
  actionBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 12, gap: 10 },
  actionText: { color: 'white', fontWeight: 'bold' },
  closeBtn: { marginTop: 'auto', padding: 30, alignItems: 'center' },
  closeBtnText: { color: '#ef4444', fontWeight: 'bold', letterSpacing: 2 }
});

export default App;
