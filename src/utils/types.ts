import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export const SearchPayload = t.type({
  numberOfPages: NonNegativeInteger,
  toSearch: NonEmptyString,
});

export type SearchPayload = t.TypeOf<typeof SearchPayload>;

export const RequestMessagePayload = t.type({
  requestId: t.string,
  searchPayload: SearchPayload,
});
export type RequestMessagePayload = t.TypeOf<typeof RequestMessagePayload>;

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
