// ... imports ...
import { collection, query, orderBy, onSnapshot, doc, setDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Wifi, WifiOff, AlertCircle, Moon } from 'lucide-react';

function App() {
  const [playlist, setPlaylist] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [terminalId, setTerminalId] = useState(localStorage.getItem('terminal_id'));
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [terminalData, setTerminalData] = useState(null);
  const [isStandby, setIsStandby] = useState(false);

  // ... (Setup inicial igual) ...

  // Novo: Monitorar Documento do Terminal para Configurações (Power Mode, Horário)
  useEffect(() => {
    if (!terminalId) return;

    const unsub = onSnapshot(doc(db, "terminals", terminalId), (docSnap) => {
      if (docSnap.exists()) {
        setTerminalData(docSnap.data());
      }
    });
    return () => unsub();
  }, [terminalId]);

  // Lógica de Standby (Centralizada)
  useEffect(() => {
    if (!terminalData) return;

    const checkStandby = () => {
      const now = new Date();
      const mode = terminalData.powerMode || 'auto';

      if (mode === 'on') {
        setIsStandby(false);
        return;
      }
      if (mode === 'off') {
        setIsStandby(true);
        return;
      }

      // Auto: Verificar Horário e Dia
      const activeDays = terminalData.activeDays || [0, 1, 2, 3, 4, 5, 6];
      const currentDay = now.getDay();

      if (!activeDays.includes(currentDay)) {
        setIsStandby(true);
        return;
      }

      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const open = terminalData.openingTime || "08:00";
      const close = terminalData.closingTime || "22:00";

      // Lógica simplificada de range (não suporta virada de noite ex: 23:00 as 05:00 ainda, assume mesmo dia)
      // Se quiser suportar virada, precisa melhorar. Assume start <= end
      if (open <= close) {
        if (currentTime >= open && currentTime <= close) {
          setIsStandby(false);
        } else {
          setIsStandby(true);
        }
      } else {
        // Caso 22:00 as 05:00 (cross midnight)
        if (currentTime >= open || currentTime <= close) {
          setIsStandby(false);
        } else {
          setIsStandby(true);
        }
      }
    };

    checkStandby();
    const interval = setInterval(checkStandby, 10000); // Check a cada 10s
    return () => clearInterval(interval);
  }, [terminalData]);

  // ... (Resto do código: Heartbeat, NetInfo, ErrorLog) ...

  // Renderização
  // ... (Setup Mode e Loading iguais) ...

  // TELA DE STANDBY (Preta para economizar energia/luz e evitar burn-in)
  if (isStandby) {
    return (
      <div className="player-container bg-black h-screen w-screen cursor-none">
        {/* Oculto: Tela 100% Preta para proteção OLED/Plasma */}
      </div>
    );
  }

  // ... (Playlist Empty Check) ...

  return (
    // ... (Main Player Render - igual ao anterior) ...
    <div className="player-container relative bg-black h-screen w-screen overflow-hidden">
      {/* ... */}
    </div>
  );
}

export default App;

{/* Indicador de Status Discreto (Debug) */ }
<div className="absolute top-4 right-4 z-50 flex items-center space-x-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full border border-white/10">
  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`} />
  {!isOnline && <WifiOff className="w-3 h-3 text-white/50" />}
</div>

{
  playlist.items.map((item, index) => {
    const isActive = index === currentIndex;

    return (
      <div
        key={`${item.id}-${index}`}
        className={`media-wrapper absolute inset-0 transition-opacity duration-500 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
      >
        {item.type === 'video' ? (
          <video
            src={item.url}
            // Preload auto ajuda no cache? Sim, mas cuidado com consumo.
            // Como é PWA CacheFirst, o browser vai tentar cachear.
            preload="auto"
            autoPlay={isActive}
            muted
            onEnded={() => {
              if (isActive) nextMedia();
            }}
            className="w-full h-full object-cover"
            // Importante: Pause quando oculto para economizar CPU
            ref={el => {
              if (el) {
                if (isActive) {
                  // Força play se o navegador bloqueou autoplay
                  const playPromise = el.play();
                  if (playPromise !== undefined) {
                    playPromise.catch(error => console.log("Autoplay prevent:", error));
                  }
                } else {
                  el.pause();
                  el.currentTime = 0; // Opcional: reiniciar vídeo
                }
              }
            }}
          />
        ) : (
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${item.url})` }}
          />
        )}
      </div>
    );
  })
}
    </div >
  );
}

export default App;
