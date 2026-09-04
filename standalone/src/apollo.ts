/**
 * Apollo client over the local v2 executable schema.
 *
 * To point at the real gateway, swap SchemaLink for an HttpLink — the operation
 * documents in the feature files need no changes.
 */
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { SchemaLink } from "@apollo/client/link/schema";
import { schemaV2 } from "./mocks/schema-v2.js";

export const clientV2 = new ApolloClient({
  link: new SchemaLink({ schema: schemaV2 }),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: "network-only" },
    query: { fetchPolicy: "network-only" },
  },
});
