export const IPC_CHANNELS = {
  // Guard
  GUARD_SCAN: 'guard:scan',
  GUARD_DEBUG_DIALOG: 'guard:debug-dialog',

  // Analytics
  ANALYTICS_KPIS: 'analytics:kpis',
  ANALYTICS_SERIES: 'analytics:series',
  ANALYTICS_HEATMAP: 'analytics:heatmap',
  ANALYTICS_BREAKDOWNS: 'analytics:breakdowns',
  ANALYTICS_INSIGHTS: 'analytics:insights',

  // Events
  EVENTS_LIST: 'events:list',
  EVENTS_EXPORT: 'events:export',
  EVENTS_CLEAR: 'events:clear',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // System
  APP_STATUS: 'app:status',
  NAVIGATE_TAB: 'app:navigate-tab',

  // Sidebar
  SIDEBAR_TOGGLE: 'sidebar:toggle',
  SIDEBAR_GET_STATE: 'sidebar:get-state'
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
