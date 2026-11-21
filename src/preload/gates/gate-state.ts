export type GateStatus = 'IDLE' | 'HELD' | 'AWAITING' | 'RELEASED' | 'BLOCKED';

export interface GateStateManager {
  getStatus: () => GateStatus;
  setStatus: (status: GateStatus) => void;
  markBypassed: (target: object) => void;
  isBypassed: (target: object) => boolean;
  clearBypass: (target: object) => void;
}

export function createGateStateManager(): GateStateManager {
  let status: GateStatus = 'IDLE';
  const bypassSet = new WeakSet<object>();

  return {
    getStatus: () => status,
    setStatus: (newStatus: GateStatus) => {
      status = newStatus;
    },
    markBypassed: (target: object) => {
      bypassSet.add(target);
    },
    isBypassed: (target: object) => {
      return bypassSet.has(target);
    },
    clearBypass: (target: object) => {
      bypassSet.delete(target);
    }
  };
}

export const globalGateState = createGateStateManager();
