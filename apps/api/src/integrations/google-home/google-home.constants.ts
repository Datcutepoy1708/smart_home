export const DEFAULT_GOOGLE_CLIENT_ID = 'smart-home-google-client';
export const DEFAULT_GOOGLE_CLIENT_SECRET = 'smarthome-secret-key-2026';

export const GOOGLE_ACTIONS = {
  SYNC: 'action.devices.SYNC',
  QUERY: 'action.devices.QUERY',
  EXECUTE: 'action.devices.EXECUTE',
  DISCONNECT: 'action.devices.DISCONNECT',
} as const;

export const GOOGLE_DEVICE_TYPES = {
  LIGHT: 'action.devices.types.LIGHT',
  FAN: 'action.devices.types.FAN',
  DOOR: 'action.devices.types.DOOR',
  SENSOR: 'action.devices.types.SENSOR',
} as const;

export const GOOGLE_TRAITS = {
  ON_OFF: 'action.devices.traits.OnOff',
  FAN_SPEED: 'action.devices.traits.FanSpeed',
  OPEN_CLOSE: 'action.devices.traits.OpenClose',
  TEMPERATURE_SETTING: 'action.devices.traits.TemperatureSetting',
  SENSOR_STATE: 'action.devices.traits.SensorState',
} as const;

export const GOOGLE_COMMANDS = {
  ON_OFF: 'action.devices.commands.OnOff',
  OPEN_CLOSE: 'action.devices.commands.OpenClose',
  SET_FAN_SPEED: 'action.devices.commands.SetFanSpeed',
} as const;
