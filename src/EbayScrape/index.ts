import * as TE from "fp-ts/TaskEither";
import { getConfigOrThrow } from "../utils/config";
import { SearchPayload } from "../utils/types";
import { scrapeEbayHandler } from "./handler";

const config = getConfigOrThrow();

export const ebaySearch = (
  searchPayload: SearchPayload
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  scrapeEbayHandler(config.EBAY_SEARCH_URL, searchPayload);

export default ebaySearch;
