import * as TE from "fp-ts/TaskEither";
import { getConfigOrThrow } from "../utils/config";
import { SearchPayload } from "../utils/types";
import { scrapeAmazonHandler } from "./handler";

const config = getConfigOrThrow();

export const amazonSearch = (
  searchPayload: SearchPayload
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  scrapeAmazonHandler(config.AMAZON_SEARCH_URL, searchPayload);

export default amazonSearch;
