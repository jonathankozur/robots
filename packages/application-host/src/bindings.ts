import { ProtocolError } from "@robots/system-api";
import type { Contract, FieldRule, MessageDefinition, Phase } from "@robots/system-api";
import { snapshotData } from "@robots/values/json";
import { NAVIGATION_MESSAGES } from "@robots/protocol/navigation/v1";
import { PRESENTATION_MESSAGES } from "@robots/protocol/presentation/v1";
import { APPLICATION_MESSAGES, beginContextDefinition } from "@robots/protocol/application/v1";

export interface MessageBinding {
  readonly producers: Contract["producers"];
  readonly responsibleSystemId?: string;
}
/** Session permissions are supplied by the host, never by a message definition. */
export function bindMessage(definition: MessageDefinition, binding: MessageBinding): Contract {
  if (definition.kind === "command" ? !binding.responsibleSystemId : binding.responsibleSystemId !== undefined) {
    throw new ProtocolError("CONFIG_INVALID", "Commands need an owner; events have no owner");
  }
  return snapshotData({
    type: definition.type, version: definition.version, kind: definition.kind, fields: definition.fields,
    producers: binding.producers,
    ...(binding.responsibleSystemId === undefined ? {} : { responsibleSystemId: binding.responsibleSystemId })
  }, 1_048_576, 128) as unknown as Contract;
}
/** The host assigns command ownership and producer IDs for this composition. */
export function bindNavigationContracts(options: {
  readonly navigationId: string; readonly requestProducers: Contract["producers"];
}): readonly Contract[] {
  return Object.freeze(NAVIGATION_MESSAGES.map(definition => bindMessage(definition,
    definition.kind === "command"
      ? { responsibleSystemId: options.navigationId, producers: options.requestProducers }
      : { producers: [{ systemId: options.navigationId, phases: [definition.type === "NavigationWorldReady" ? "input" : "movement"] }] })));
}
export function bindPresentationContracts(presentationId: string): readonly Contract[] {
  return Object.freeze(PRESENTATION_MESSAGES.map(definition => bindMessage(definition,
    { producers: [{ systemId: presentationId, phases: ["action"] }] })));
}
export function bindApplicationContracts(
  participants: readonly { readonly id: string; readonly phase: Phase }[],
  viewFields: Readonly<Record<string, FieldRule>>
): readonly Contract[] {
  return [
    bindMessage(beginContextDefinition(viewFields), {
      responsibleSystemId: "app-coordinator", producers: [{ systemId: "app-bootstrap", phases: ["input"] }]
    }),
    ...APPLICATION_MESSAGES.map(definition => bindMessage(definition, {
      producers: definition.type === "ApplicationParticipantInitialized" || definition.type === "ApplicationParticipantRejected"
        ? participants.map(p => ({ systemId: p.id, phases: [p.phase] }))
        : [{ systemId: "app-coordinator", phases: ["publication"] }]
    }))
  ];
}
