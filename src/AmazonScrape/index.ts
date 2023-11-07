import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { getConfigOrThrow } from "../utils/config";
import { scrapeAmazonHandler } from "./handler";
import { Browser } from "puppeteer";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

const config = getConfigOrThrow();

export const amazonSearch = (toSearch: NonEmptyString, numberOfPages: NonNegativeInteger = 1 as NonNegativeInteger) => scrapeAmazonHandler(
  config.AMAZON_SEARCH_URL,
  toSearch,
  numberOfPages
);

export default amazonSearch;
