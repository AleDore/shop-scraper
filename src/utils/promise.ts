import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { pipe } from "fp-ts/lib/function";

export const delay = (pollingIntervalMs: number): TE.TaskEither<never, void> =>
  pipe(T.delay(pollingIntervalMs)(T.of(void 0)), TE.fromTask);
