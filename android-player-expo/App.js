import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, StatusBar } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');
const MAPPING_FILE = `${FileSystem.documentDirectory}media_mapping.json`;

export default function App() {
  const [playlist, setPlaylist] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localFiles, setLocalFiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(MAPPING_FILE);
        if (info.exists) {
          const content = await FileSystem.readAsStringAsync(MAPPING_FILE);
          setLocalFiles(JSON.parse(content));
        }
      } catch (e) {
        console.error("Erro ao carregar mapa:", e);
      }
    })();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const pl = snapshot.docs[0].data();
        setPlaylist(pl);
        if (pl.items) downloadMediaFiles(pl.items);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const downloadMediaFiles = async (items) => {
    let updated = false;
    const newLocalFiles = { ...localFiles };

    for (const item of items) {
      const fileName = (item.mediaId || item.name).replace(/[^a-zA-Z0-9.]/g, '_');
      const localPath = `${FileSystem.documentDirectory}${fileName}`;

      const info = await FileSystem.getInfoAsync(localPath);
      if (!info.exists) {
        try {
          const downloadRes = await FileSystem.downloadAsync(item.url, localPath);
          newLocalFiles[item.url] = downloadRes.uri;
          updated = true;
        } catch (err) {
          console.error("Download falhou:", item.name, err);
        }
      } else {
        if (!newLocalFiles[item.url]) {
          newLocalFiles[item.url] = info.uri;
          updated = true;
        }
      }
    }

    if (updated) {
      setLocalFiles(newLocalFiles);
      await FileSystem.writeAsStringAsync(MAPPING_FILE, JSON.stringify(newLocalFiles));
    }
  };

  const logProofOfPlay = useCallback(async (mediaItem) => {
    try {
      await addDoc(collection(db, "logs"), {
        mediaId: mediaItem.mediaId || 'unknown',
        mediaName: mediaItem.name,
        timestamp: serverTimestamp(),
        type: 'exhibition',
        deviceId: 'POCO-F5-USER'
      });
    } catch (e) {
      console.error("Log falhou:", e);
    }
  }, []);

  useEffect(() => {
    if (!playlist || !playlist.items?.length) return;

    const item = playlist.items[currentIndex];
    logProofOfPlay(item);

    if (item.type === 'image') {
      const timer = setTimeout(nextMedia, (parseInt(item.duration) || 10) * 1000);
      return () => clearTimeout(timer);
    }
  }, [playlist, currentIndex, logProofOfPlay]);

  const nextMedia = () => {
    if (playlist?.items?.length) {
      setCurrentIndex((prev) => (prev + 1) % playlist.items.length);
    }
  };

  if (loading && !playlist) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <Text style={styles.text}>🚀 Conecta Local...</Text>
      </View>
    );
  }

  if (!playlist?.items?.length) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <Text style={styles.text}>📅 Sem Programação</Text>
      </View>
    );
  }

  const currentItem = playlist.items[currentIndex];
  const source = localFiles[currentItem.url] ? { uri: localFiles[currentItem.url] } : { uri: currentItem.url };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {currentItem.type === 'video' ? (
        <Video
          source={source}
          rate={1.0}
          volume={1.0}
          isMuted={true}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          onPlaybackStatusUpdate={(status) => {
            if (status.didJustFinish) nextMedia();
          }}
          style={styles.fullscreen}
        />
      ) : (
        <Image source={source} style={styles.fullscreen} resizeMode="cover" />
      )}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{localFiles[currentItem.url] ? 'OFFLINE 🛡️' : 'STREAMING ☁️'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  fullscreen: { width: width, height: height, position: 'absolute' },
  text: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  badge: { position: 'absolute', bottom: 30, right: 30, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { color: '#00ffcc', fontSize: 10, fontWeight: 'bold' }
});
