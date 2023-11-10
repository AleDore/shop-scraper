import { pipe } from "fp-ts/lib/function";
import * as AR from "fp-ts/Array";
import * as TE from "fp-ts/TaskEither";
import amazonSearch from "../AmazonScrape";
import ebaySearch from "../EbayScrape";
import { SearchPayload } from "./types";

export const searchAllShop = (
  searchPayload: SearchPayload
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  pipe(
    [amazonSearch(searchPayload), ebaySearch(searchPayload)],
    AR.sequence(TE.ApplicativePar),
    TE.map(AR.flatten)
  );
