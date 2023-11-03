import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { getConfigOrThrow } from "../utils/config";
import { scrapeAmazonHandler } from "./handler";
import { Browser } from "puppeteer";

const config = getConfigOrThrow();

export const amazonSearch = (toSearch: NonEmptyString) => scrapeAmazonHandler(
  config.AMAZON_SEARCH_URL,
  toSearch
);

export default amazonSearch;
