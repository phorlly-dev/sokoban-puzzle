import Phaser from "phaser";

// Used to emit events between components, HTML and Phaser scenes
export const RemoteEvent = new Phaser.Events.EventEmitter();
const GameEvent = {
    onEvents({ events, callbacks }) {
        events.forEach((event, idx) => {
            RemoteEvent.on(event, callbacks[idx]);
        });
    },
    offEvents({ events, callbacks }) {
        events.forEach((event, idx) => {
            RemoteEvent.off(event, callbacks[idx]);
        });
    },
    emitEvents({ events, args = [] }) {
        events.forEach((event, idx) => {
            RemoteEvent.emit(event, args[idx]);
        });
    },
    emitEvent(event, arg = null) {
        RemoteEvent.emit(event, arg);
    },
    onEvent(event, callback = Function) {
        RemoteEvent.on(event, callback);
    },
    offEvent(event, callback = Function) {
        RemoteEvent.off(event, callback);
    },
    onceEvent(event, callback = Function) {
        RemoteEvent.once(event, callback);
    },
};

export const {
    onEvents,
    offEvents,
    emitEvents,
    emitEvent,
    onEvent,
    offEvent,
    onceEvent,
} = GameEvent;
