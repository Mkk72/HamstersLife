/**
 * Точка входа Worker. Вся логика — в `SimHost`, здесь только приём сообщений и
 * отправка ответов. Свой таймер не заводим: главный поток просит тик сам, так
 * проще останавливать игру и тестировать.
 */
import { SimHost } from './simHost';
import type { FromWorker, ToWorker } from './workerProtocol';

interface WorkerScope {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker): void;
}

const scope = self as unknown as WorkerScope;

let host: SimHost | null = null;

scope.onmessage = (event) => {
  const message = event.data;

  if (message.type === 'init') {
    host = new SimHost(message.map, message.balance, message.seed);
    scope.postMessage({ type: 'ready' });
    return;
  }

  if (!host) return;
  for (const outgoing of host.handle(message)) scope.postMessage(outgoing);
};
