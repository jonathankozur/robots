// Legacy laboratory preset only. New hosts bind neutral definitions explicitly.
export * from "@robots/protocol/navigation/v1";
import { bindNavigationContracts } from "@robots/application-host/bindings";
export const navigationContracts = () => bindNavigationContracts({ navigationId:"navigation", requestProducers:[{systemId:"navigation-agent-fixture",phases:["decision"]}] });
