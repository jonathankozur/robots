import type { Actor } from '@robots/system-api';
import type { Payload } from '@robots/system-api';
import { checkedAdd } from '@robots/values/numeric';
import type { Publisher } from '@robots/system-api';
import type { World, Result } from '@robots/protocol/navigation/v1';
import type { Assembly, View } from '@robots/protocol/presentation/v1';
import { frozen, fail } from './plain.ts';
export function createPresentationActor(inputIdentity: Payload): Actor {
    const identity = frozen(inputIdentity);
    let publisher: Publisher, boardId = '', assemblies: readonly Assembly[] = [], initialized = false, active = false, world: World | undefined, dirty = false, sequence = 0;
    let movements: View['movements'][number][] = [];
    return {
        connect(p) { publisher = p; },
        initialize(m) {
            if (initialized)
                fail('Repeated initialization');
            for (const k of ['contextId', 'attemptId', 'bundleId', 'contentRevision'])
                if (m.payload[k] !== identity[k])
                    fail('Wrong identity');
            if (m.sessionId !== identity.contextId)
                fail('Wrong session');
            const view = m.payload.view as unknown as {
                boardId: string;
                assemblies: readonly Assembly[];
            };
            boardId = view.boardId;
            assemblies = frozen(view.assemblies);
            if (new Set(assemblies.map(a => a.robotId)).size !== assemblies.length)
                fail('Duplicate assembly');
            for (const a of assemblies)
                if (new Set(a.parts.map(p => p.slotId)).size !== a.parts.length || new Set(a.parts.map(p => p.socketId)).size !== a.parts.length)
                    fail('Duplicate mounting');
            initialized = true;
            publisher.emit('ApplicationParticipantInitialized', 1, { ...identity, participantId: 'presentation' });
        },
        activate(m) { if (!initialized || active || m.sessionId !== identity.contextId)
            fail('Invalid activation'); active = true; },
        subscriptions: [
            { type: 'NavigationWorldReady', phase: 'action', handler(m) {
                    if (!active || world || m.payload.boardId !== boardId)
                        fail('Invalid initial world');
                    world = frozen(m.payload as unknown as World);
                    if (world.robots.length !== assemblies.length || world.robots.some(r => !assemblies.some(a => a.robotId === r.robotId)))
                        fail('Assembly mismatch');
                    dirty = true;
                } },
            { type: 'NavigationStepResolved', phase: 'action', handler(m) {
                    if (!world || m.sessionId !== identity.contextId)
                        fail('No active world');
                    const r = m.payload as unknown as Result;
                    if (!r.accepted || r.duplicate)
                        return;
                    const previous = world.robots.find(x => x.robotId === r.robotId);
                    if (r.reason !== 'MOVED' || r.boardId !== boardId || r.boardRevision !== checkedAdd(world.boardRevision, 1) || !previous || !r.robotState || r.robotState.robotRevision !== checkedAdd(previous.robotRevision, 1) || previous.q !== r.from.q || previous.r !== r.from.r || r.to.q !== r.robotState.position.q || r.to.r !== r.robotState.position.r)
                        fail('Contradictory confirmed move');
                    if (movements.length >= 16)
                        fail('Movement projection capacity');
                    world = frozen({ ...world, boardRevision: r.boardRevision, effectiveTick: r.resolvedTick, robots: world.robots.map(x => x.robotId === r.robotId ? { ...x, ...r.robotState!.position, robotRevision: r.robotState!.robotRevision, readyAtTick: r.robotState!.readyAtTick } : x) });
                    movements.push(frozen({ ...r, sourceMessageId: m.messageId }));
                    dirty = true;
                } }
        ],
        loopPhase: 'action', loop(c) { if (active && world && dirty) {
            sequence = checkedAdd(sequence, 1);
            publisher.emit('PresentationViewPublished', 1, { contextId: identity.contextId, boardId, sequence, observedTick: c.tick, world, assemblies, movements } as unknown as Payload, { causes: [] });
            movements = [];
            dirty = false;
        } }
    };
}
