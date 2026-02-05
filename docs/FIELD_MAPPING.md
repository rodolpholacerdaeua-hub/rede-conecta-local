# Rede Conecta - Mapeamento de Campos (Firebase → Supabase)

## 📋 Referência Rápida

Este documento mapeia os campos usados no código React (camelCase) para os campos no PostgreSQL/Supabase (snake_case).

---

## 🖥️ Tabela: `terminals`

| React (camelCase) | PostgreSQL (snake_case) | Tipo | Descrição |
|---|---|---|---|
| `openingTime` | `operating_start` | TIME | Hora de início de operação |
| `closingTime` | `operating_end` | TIME | Hora de fim de operação |
| `activeDays` | `operating_days` | INTEGER[] | Dias ativos (0=Dom...6=Sab) |
| `powerMode` | `power_mode` | TEXT | 'auto', 'on', 'off' |
| `assignedPlaylistId` | `assigned_playlist_id` | UUID | FK para playlists |
| `currentMedia` | `current_media` | TEXT | Nome da mídia em reprodução |
| `hardwareId` | `hardware_id` | TEXT | ID único do dispositivo |
| `lastSeen` | `last_seen` | TIMESTAMP | Último heartbeat |
| `ownerId` | `owner_id` | UUID | FK para users |
| `createdAt` | `created_at` | TIMESTAMP | Data de criação |

---

## 🎬 Tabela: `playlists`

| React (camelCase) | PostgreSQL (snake_case) | Tipo |
|---|---|---|
| `ownerId` | `owner_id` | UUID |
| `createdAt` | `created_at` | TIMESTAMP |

---

## 🖼️ Tabela: `media`

| React (camelCase) | PostgreSQL (snake_case) | Tipo |
|---|---|---|
| `ownerId` | `owner_id` | UUID |
| `createdAt` | `created_at` | TIMESTAMP |

---

## 🔗 Tabela: `pairing_codes`

| React (camelCase) | PostgreSQL (snake_case) | Tipo |
|---|---|---|
| `terminalId` | `terminal_id` | UUID |
| `expiresAt` | `expires_at` | TIMESTAMP |
| `pairedAt` | `paired_at` | TIMESTAMP |
| `hardwareId` | `hardware_id` | TEXT |

---

## ⚠️ Valores de Orientação

| UI (React) | Banco (PostgreSQL) |
|---|---|
| `horizontal` | `landscape` |
| `vertical` | `portrait` |

---

## 🛠️ Helper Code (handleUpdateField)

```javascript
const fieldMap = {
    'openingTime': 'operating_start',
    'closingTime': 'operating_end',
    'activeDays': 'operating_days',
    'powerMode': 'power_mode',
    'currentMedia': 'current_media'
};
const dbField = fieldMap[field] || field;
```

---

## 📚 Referências
- [Admin_Panel_Supabase_Migration.md](file:///C:/Users/rodol/.gemini/antigravity/knowledge/capacitor_native_driven_signage/artifacts/implementation/Admin_Panel_Supabase_Migration.md)
- [Supabase_Integration_Full.md](file:///C:/Users/rodol/.gemini/antigravity/knowledge/capacitor_native_driven_signage/artifacts/implementation/Supabase_Integration_Full.md)
