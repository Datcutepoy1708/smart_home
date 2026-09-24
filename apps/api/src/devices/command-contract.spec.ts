import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { commandParams, confirmedCommandState } from './command-contract.js';

describe('commandParams', () => {
  it('maps LIGHT turn_on and turn_off to power params', () => {
    expect(commandParams('LIGHT', 'turn_on')).toEqual({ power: 'on' });
    expect(commandParams('LIGHT', 'turn_off')).toEqual({ power: 'off' });
  });

  it('maps FAN turn_on and turn_off to power params', () => {
    expect(commandParams('FAN', 'turn_on')).toEqual({ power: 'on' });
    expect(commandParams('FAN', 'turn_off')).toEqual({ power: 'off' });
  });

  it('maps DOOR_SERVO open, close, and set_angle with angle parameter', () => {
    expect(commandParams('DOOR_SERVO', 'open')).toEqual({ position: 'open', angle: 90 });
    expect(commandParams('DOOR_SERVO', 'open', 120)).toEqual({ position: 'open', angle: 120 });
    expect(commandParams('DOOR_SERVO', 'close')).toEqual({ position: 'closed', angle: 0 });
    expect(commandParams('DOOR_SERVO', 'set_angle', 45)).toEqual({ position: 'open', angle: 45 });
    expect(commandParams('DOOR_SERVO', 'set_angle', 0)).toEqual({ position: 'closed', angle: 0 });
  });

  it('throws BadRequestException for unsupported device types or actions', () => {
    expect(() => commandParams('DHT_SENSOR', 'turn_on')).toThrow(BadRequestException);
    expect(() => commandParams('LIGHT', 'open')).toThrow(BadRequestException);
    expect(() => commandParams('DOOR_SERVO', 'turn_on')).toThrow(BadRequestException);
  });
});

describe('confirmedCommandState', () => {
  it('validates and extracts power state for LIGHT and FAN', () => {
    expect(confirmedCommandState('LIGHT', { power: 'on' })).toEqual({ power: 'on' });
    expect(confirmedCommandState('FAN', { power: 'off' })).toEqual({ power: 'off' });
  });

  it('validates and extracts position and optional angle for DOOR_SERVO', () => {
    expect(confirmedCommandState('DOOR_SERVO', { position: 'open' })).toEqual({ position: 'open' });
    expect(confirmedCommandState('DOOR_SERVO', { position: 'closed', angle: 90 })).toEqual({
      position: 'closed',
      angle: 90,
    });
  });

  it('throws ConflictException on invalid or non-object state', () => {
    expect(() => confirmedCommandState('LIGHT', null)).toThrow(ConflictException);
    expect(() => confirmedCommandState('LIGHT', 'on')).toThrow(ConflictException);
    expect(() => confirmedCommandState('LIGHT', [])).toThrow(ConflictException);
    expect(() => confirmedCommandState('LIGHT', { power: 'invalid' })).toThrow(ConflictException);
    expect(() => confirmedCommandState('DOOR_SERVO', { position: 'ajar' })).toThrow(ConflictException);
    expect(() => confirmedCommandState('DOOR_SERVO', { position: 'open', angle: 250 })).toThrow(ConflictException);
  });
});
