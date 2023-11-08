import * as TE from "fp-ts/TaskEither";
import { getConfigOrThrow } from "../utils/config";
import { SearchPayload } from "../utils/types";
import { scrapeAliExpressHandler } from "./handler";

const config = getConfigOrThrow();

export const aliExpressSearch = (
  searchPayload: SearchPayload
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  scrapeAliExpressHandler(config.ALIEXPRESS_SEARCH_URL, searchPayload);

export default aliExpressSearch;
