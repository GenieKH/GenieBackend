import { inLocale, texts } from '../delivery/notification-texts';
import { PushContent, PushTarget } from '../delivery/push-sender';

/** A ringing call is useless once the caller has given up. */
export const RING_SECONDS = 45;

export interface CallEvent {
  callId: string;
  callerId: string;
  callerName: string;
  calleeId: string;
}

export interface CallEndedEvent extends CallEvent {
  /** Nobody answered: the callee is told they missed it. */
  missed: boolean;
}

/**
 * Android gets a silent, urgent data message and rings full screen itself.
 * iOS (no CallKit yet) and the web show an ordinary notification that opens
 * the app on the incoming call.
 */
export function incomingCallPush(
  event: CallEvent,
  target: PushTarget,
): PushContent {
  return {
    alert:
      target.platform === 'android'
        ? undefined
        : {
            title: inLocale(
              texts.incomingCall,
              target.locale,
            )(event.callerName),
            body: inLocale(texts.tapToAnswer, target.locale),
          },
    data: {
      type: 'call_incoming',
      callId: event.callId,
      callerId: event.callerId,
      callerName: event.callerName,
      sentAt: new Date().toISOString(),
    },
    channel: 'calls',
    tag: `call:${event.callId}`,
    urgent: true,
    timeToLiveSeconds: RING_SECONDS,
  };
}

/**
 * Stops the ringing on Android. A missed call is also announced; elsewhere
 * an ended call that was answered or cancelled needs nothing.
 */
export function callEndedPush(
  event: CallEndedEvent,
  target: PushTarget,
): PushContent | null {
  const data = {
    type: 'call_ended',
    callId: event.callId,
    callerId: event.callerId,
    callerName: event.callerName,
    missed: String(event.missed),
  };
  if (target.platform === 'android') {
    return {
      data,
      channel: 'calls',
      tag: `call:${event.callId}`,
      urgent: true,
      timeToLiveSeconds: RING_SECONDS,
    };
  }
  if (!event.missed) return null;
  return {
    alert: {
      title: inLocale(texts.missedCall, target.locale),
      body: inLocale(texts.missedCallFrom, target.locale)(event.callerName),
    },
    data,
    channel: 'calls',
    tag: `call:${event.callId}`,
    urgent: false,
  };
}
