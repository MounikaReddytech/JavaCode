// 1. INSTALL SOCKJS DEPENDENCY FIRST:
// npm install sockjs-client @types/sockjs-client

// 2. ADD IMPORT AT TOP OF YOUR SERVICE FILE:
import * as SockJS from 'sockjs-client';

// 3. REPLACE YOUR connect() METHOD WITH THIS:
public connect(): void {
  if (this.stompClient?.connected) {
    console.log('[SRR Service]: Already connected');
    return;
  }

  if (this.stompClient?.active) {
    console.log('[SRR Service]: Connection already in progress');
    return;
  }

  try {
    this.stompClient = new Client({
      // ❌ REMOVE: brokerURL: 'ws://...'
      
      // ✅ USE SockJS WebSocket Factory instead:
      webSocketFactory: () => {
        return new SockJS('http://localhost:8080/ws'); // Your SockJS endpoint
      },

      debug: (str: string): void => {
        console.log('[STOMP Debug]:', str);
      },

      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: (frame: any): void => {
        console.log('[SRR Service]: WebSocket connection established', frame);
        this.connectionState$.next(true);
      },

      onStompError: (frame: any): void => {
        console.error('[SRR Service]: STOMP error', frame);
        this.connectionState$.next(false);
      },

      onWebSocketClose: (event: any): void => {
        console.warn('[SRR Service]: WebSocket connection closed', event);
        this.connectionState$.next(false);
      },

      onWebSocketError: (error: any): void => {
        console.error('[SRR Service]: WebSocket error', error);
        this.connectionState$.next(false);
      }
    });

    this.stompClient.activate();
    
  } catch (error) {
    console.error('[SRR Service]: Error creating STOMP client', error);
    this.connectionState$.next(false);
  }
}

// 4. UPDATE YOUR ENVIRONMENT CONFIG:
// environment.ts
export const environment = {
  production: false,
  WS_ENDPOINT: 'http://localhost:8080/ws', // SockJS endpoint (HTTP, not WS)
  // ... other config
};

// 5. REPLACE YOUR subscribeToTopic METHOD:
public subscribeToTopic(topic: string): Observable<any> {
  if (!this.stompClient) {
    throw new Error('WebSocket client is not initialized. Call connect() first.');
  }

  if (!this.connectionState$.value) {
    throw new Error('WebSocket connection is not established.');
  }

  const subject = new Subject<any>();

  try {
    const subscription = this.stompClient.subscribe(topic, (message: any) => {
      try {
        const parsedMessage = JSON.parse(message.body);
        console.log('[SRR Service] Incoming message:', parsedMessage);
        subject.next(parsedMessage);
      } catch (error) {
        console.error('[SRR Service]: Error parsing message', error);
        subject.error(error);
      }
    });

    this.subscriptions.push(subscription);

    return subject.asObservable();

  } catch (error) {
    console.error('[SRR Service]: Error subscribing to topic', error);
    throw error;
  }
}
