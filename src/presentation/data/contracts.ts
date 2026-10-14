// Compatibility preset; session authorization belongs to the host.
export * from "@robots/protocol/presentation/v1";
import { bindPresentationContracts } from "@robots/application-host/bindings";
export const presentationContracts = () => bindPresentationContracts("presentation");
