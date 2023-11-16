import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export const SearchPayload = t.type({
  numberOfPages: NonNegativeInteger,
  toSearch: NonEmptyString,
});

export type SearchPayload = t.TypeOf<typeof SearchPayload>;

export const SearchRequestMessagePayload = t.type({
  requestId: t.string,
  searchPayload: SearchPayload,
});
export type SearchRequestMessagePayload = t.TypeOf<
  typeof SearchRequestMessagePayload
>;

export const PageSearchRequestMessagePayload = t.type({
  page: t.number,
  requestId: t.string,
  searchPayload: SearchPayload,
});
export type PageSearchRequestMessagePayload = t.TypeOf<
  typeof PageSearchRequestMessagePayload
>;

export const PendingSearchResults = t.type({
  status: t.literal("PENDING"),
});
export const OkSearchResults = t.type({
  numOfPages: t.number,
  status: t.literal("OK"),
});
export type OkSearchResults = t.TypeOf<typeof OkSearchResults>;
export const KoSearchResults = t.type({
  error: t.string,
  status: t.literal("KO"),
});

export const SearchResults = t.union([
  PendingSearchResults,
  KoSearchResults,
  OkSearchResults,
]);
export type SearchResults = t.TypeOf<typeof SearchResults>;

export const SearchResultsPage = t.type({
  page: t.number,
  results: t.readonlyArray(t.unknown),
});
export type SearchResultsPage = t.TypeOf<typeof SearchResultsPage>;
