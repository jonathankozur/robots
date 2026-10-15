import { bindPresentationContracts } from '@robots/application-host/bindings';
import { navigationRecipe, scenario } from './navigation-fixture.ts';
import content from '../../content/fixtures/presentation-v2.json' with { type: 'json' };
import type { Recipe, Request } from '@robots/application-host';
import type { Payload } from '@robots/runtime';
import { createPresentationActor, INITIAL_FIELDS } from '@robots/presentation';
export function presentationRecipe(): Recipe {
    const base = navigationRecipe();
    return { ...base, id: 'presentation.fixture', revision: 'presentation-fixture-v1',
        prepare(content, selection) {
            const views = base.prepare(content, selection);
            const robots = (views.navigation!.robots as unknown as {
                robotId: string;
                definitionId: string;
            }[]);
            const visual = robots.map(r => {
                const def = content.definitions.robots.find(x => x.id === r.definitionId)!;
                const chassis = content.definitions.chassis.find(x => x.id === def.chassisId)!;
                const families = [...content.definitions.cores, ...content.definitions.locomotions, ...content.definitions.ais, ...content.definitions.sensors, ...content.definitions.weapons];
                if (!chassis.visual)
                    throw Error('Missing chassis visual');
                return { robotId: r.robotId, chassisResourceId: chassis.visual.resourceId, parts: def.equipment.flatMap(e => { const slot = chassis.slots.find(s => s.id === e.slotId)!, part = families.find(f => f.id === e.componentId)!; if (!part.visual)
                        return []; if (!slot.socketId)
                        throw Error('Missing visual socket'); return [{ slotId: e.slotId, socketId: slot.socketId, resourceId: part.visual.resourceId }]; }) };
            });
            return { ...views, presentation: { boardId: views.navigation!.boardId, assemblies: visual } as Payload };
        },
        contracts: [...base.contracts, ...bindPresentationContracts('presentation')],
        outputTypes: [...base.outputTypes, {type: 'PresentationViewPublished', version: 1}],
        participants: [...base.participants, { id: 'presentation', initializationType: 'InitializePresentationView', phase: 'action', fields: INITIAL_FIELDS, create: (identity, _resource, context) => createPresentationActor(identity, context) }] };
}
export function presentationRequest(s = scenario(), requestId = 'presentation', debug = false): Request { return { requestId, seed: '0123456789abcdef', content: JSON.parse(JSON.stringify(content)), selection: s as unknown as Payload, debug }; }
