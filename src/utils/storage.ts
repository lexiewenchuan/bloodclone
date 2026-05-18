
import { Seat, RoleData, FabledData, JinxedData, ScriptInfo, Status, GamePhase } from '../types';

const STORAGE_KEY = 'botc_app_state_v1';

// Serialized types
interface SerializedStatus {
  name: string;
  roleId?: string;
  type: 'global' | 'local' | 'custom';
  addedAt?: {
    phase: 'night' | 'day';
    count: number;
  };
}

interface SerializedSeat {
  id: number;
  playerName: string;
  roleId: string | null;
  roleName: string;
  index: number;
  isDead: boolean;
  hasVote: boolean;
  isFlipped: boolean;
  alignment?: 'good' | 'evil';
  abilityRoleId?: string | null;
  perceivedRoleId?: string | null;
  health?: 'sober' | 'poisoned' | 'drunk';
  statuses: SerializedStatus[];
}

interface SerializedGamePhase {
  type: 'night' | 'day';
  count: number;
  seats: SerializedSeat[];
  devilGuiseRoleIds: (string | null)[];
  selectedFabledRoleIds: string[];
  selectedTravelerRoleIds: string[];
}

export interface SerializedAppState {
  seats: SerializedSeat[];
  scriptInfo: ScriptInfo;
  roles: {
    townsfolk: RoleData[];
    outsider: RoleData[];
    minion: RoleData[];
    demon: RoleData[];
  };
  fabledRoles: FabledData[];
  travelerRoles: FabledData[];
  selectedFabledRoleIds: string[];
  selectedTravelerRoleIds: string[];
  jinxedRoles: JinxedData[];
  devilGuiseRoleIds: (string | null)[];
  history: SerializedGamePhase[];
  currentPhaseIndex: number;
  grimoireSettings: {
    dayBackgroundImage: string;
    nightBackgroundImage: string;
    hideRoleAbilities: boolean;
    hideNightInstructions: boolean;
  };
  phaseNotes: Record<string, any>;
  phaseCustomNotes: Record<string, string>;
  timestamp: number;
}

// Helper to build role map
const buildRoleMap = (
  roles: {
    townsfolk: RoleData[];
    outsider: RoleData[];
    minion: RoleData[];
    demon: RoleData[];
  },
  fabledRoles: FabledData[],
  travelerRoles: FabledData[]
) => {
  const map = new Map<string, RoleData | FabledData>();
  [
    ...roles.townsfolk,
    ...roles.outsider,
    ...roles.minion,
    ...roles.demon,
    ...fabledRoles,
    ...travelerRoles
  ].forEach(role => map.set(role.id, role));
  return map;
};

const serializeSeat = (seat: Seat): SerializedSeat => ({
  id: seat.id,
  playerName: seat.playerName,
  roleId: seat.role?.id || null,
  roleName: seat.roleName,
  index: seat.index,
  isDead: seat.isDead,
  hasVote: seat.hasVote,
  isFlipped: seat.isFlipped,
  ...(seat.alignment != null && { alignment: seat.alignment }),
  ...(seat.abilityRole != null && { abilityRoleId: seat.abilityRole?.id ?? null }),
  ...(seat.perceivedRole != null && { perceivedRoleId: seat.perceivedRole?.id ?? null }),
  ...(seat.health != null && { health: seat.health }),
  statuses: seat.statuses.map(s => ({
    name: s.name,
    roleId: s.role?.id,
    type: s.type,
    addedAt: s.addedAt
  }))
});

const deserializeSeat = (seat: SerializedSeat, roleMap: Map<string, RoleData | FabledData>): Seat => {
  const role = seat.roleId ? (roleMap.get(seat.roleId) as RoleData || null) : null;
  return {
    id: seat.id,
    playerName: seat.playerName,
    role,
    roleName: seat.roleName,
    index: seat.index,
    isDead: seat.isDead,
    hasVote: seat.hasVote,
    isFlipped: seat.isFlipped,
    ...(seat.alignment != null && { alignment: seat.alignment }),
    ...('abilityRoleId' in seat && { abilityRole: seat.abilityRoleId ? (roleMap.get(seat.abilityRoleId!) as RoleData || null) : null }),
    ...('perceivedRoleId' in seat && { perceivedRole: seat.perceivedRoleId ? (roleMap.get(seat.perceivedRoleId!) as RoleData || null) : null }),
    ...(seat.health != null && { health: seat.health }),
    statuses: seat.statuses.map(s => {
      if (s.type === 'custom') {
        return {
          name: s.name,
          type: s.type,
          addedAt: s.addedAt
        } as Status;
      }
      const statusRole = roleMap.get(s.roleId!) as RoleData;
      if (!statusRole) return null;
      return {
        name: s.name,
        role: statusRole,
        type: s.type,
        addedAt: s.addedAt
      } as Status;
    }).filter((s): s is Status => s !== null)
  };
};

const serializeGamePhase = (phase: GamePhase): SerializedGamePhase => ({
  type: phase.type,
  count: phase.count,
  seats: phase.seats.map(serializeSeat),
  devilGuiseRoleIds: phase.devilGuiseRoles.map(r => r?.id || null),
  selectedFabledRoleIds: phase.selectedFabledRoles.map(r => r.id),
  selectedTravelerRoleIds: phase.selectedTravelerRoles.map(r => r.id)
});

export const deserializeGamePhase = (phase: SerializedGamePhase, roleMap: Map<string, RoleData | FabledData>): GamePhase => ({
  type: phase.type,
  count: phase.count,
  seats: phase.seats.map(s => deserializeSeat(s, roleMap)),
  devilGuiseRoles: phase.devilGuiseRoleIds.map(id => id ? (roleMap.get(id) as RoleData || null) : null),
  selectedFabledRoles: phase.selectedFabledRoleIds.map(id => roleMap.get(id) as FabledData).filter(Boolean),
  selectedTravelerRoles: phase.selectedTravelerRoleIds.map(id => roleMap.get(id) as FabledData).filter(Boolean)
});

export const serializeAppState = (state: any): SerializedAppState => ({
  seats: state.seats.map(serializeSeat),
  scriptInfo: state.scriptInfo,
  roles: state.roles,
  fabledRoles: state.fabledRoles,
  travelerRoles: state.travelerRoles,
  selectedFabledRoleIds: state.selectedFabledRoles.map((r: FabledData) => r.id),
  selectedTravelerRoleIds: state.selectedTravelerRoles.map((r: FabledData) => r.id),
  jinxedRoles: state.jinxedRoles,
  devilGuiseRoleIds: state.devilGuiseRoles.map((r: RoleData | null) => r?.id || null),
  history: state.history.map(serializeGamePhase),
  currentPhaseIndex: state.currentPhaseIndex,
  grimoireSettings: state.grimoireSettings,
  phaseNotes: state.phaseNotes || {},
  phaseCustomNotes: state.phaseCustomNotes || {},
  timestamp: Date.now()
});

export const deserializeAppState = (serialized: SerializedAppState): any => {
  const roleMap = buildRoleMap(serialized.roles, serialized.fabledRoles, serialized.travelerRoles);

  return {
    seats: serialized.seats.map(s => deserializeSeat(s, roleMap)),
    scriptInfo: serialized.scriptInfo,
    roles: serialized.roles,
    fabledRoles: serialized.fabledRoles,
    travelerRoles: serialized.travelerRoles,
    selectedFabledRoles: serialized.selectedFabledRoleIds.map(id => roleMap.get(id) as FabledData).filter(Boolean),
    selectedTravelerRoles: serialized.selectedTravelerRoleIds.map(id => roleMap.get(id) as FabledData).filter(Boolean),
    jinxedRoles: serialized.jinxedRoles,
    devilGuiseRoles: serialized.devilGuiseRoleIds.map(id => id ? (roleMap.get(id) as RoleData || null) : null),
    history: serialized.history.map(p => deserializeGamePhase(p, roleMap)),
    currentPhaseIndex: serialized.currentPhaseIndex,
    grimoireSettings: serialized.grimoireSettings,
    phaseNotes: serialized.phaseNotes || {},
    phaseCustomNotes: serialized.phaseCustomNotes || {}
  };
};

export const saveState = (state: any) => {
  try {
    const serialized = serializeAppState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    console.log('[Storage] State saved', new Date().toISOString());
  } catch (error) {
    console.error('[Storage] Failed to save state:', error);
  }
};

export const loadState = (): any | null => {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    const serialized = JSON.parse(json) as SerializedAppState;
    
    // Check if data is too old? (Optional)
    // For now, just load it.
    
    console.log('[Storage] State loaded', new Date(serialized.timestamp).toISOString());
    return deserializeAppState(serialized);
  } catch (error) {
    console.error('[Storage] Failed to load state:', error);
    return null;
  }
};
