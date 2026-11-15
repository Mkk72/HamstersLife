/**
 * Протокол обмена с Worker. Ядро не знает про Worker, а Worker не знает про
 * Pixi: между ними только эти сообщения.
 */
import type { Balance, Command, CommandResult, GameState, MapDefinition } from '@hamsters/core';

export type ToWorker =
  | {
      readonly type: 'init';
      readonly map: MapDefinition;
      readonly balance: Balance;
      readonly seed: number;
    }
  | { readonly type: 'start' }
  | { readonly type: 'stop' }
  | { readonly type: 'tick-request' }
  | { readonly type: 'command'; readonly command: Command };

export type FromWorker =
  | { readonly type: 'ready' }
  | { readonly type: 'snapshot'; readonly state: GameState }
  | { readonly type: 'result'; readonly result: CommandResult };
